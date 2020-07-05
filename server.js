const express = require('express');
const https = require('https');
const websocket = require('websocket');
const winston = require('winston');

const colorizer = winston.format.colorize();
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.splat(),
    winston.format.printf((info) => {
      const leftBracket = colorizer.colorize(info.level, "[");
      const rightBracket = colorizer.colorize(info.level, "]");
      return `${info.timestamp} ${leftBracket}${info.level.toUpperCase()}${rightBracket} ${info.message}`;
    }),
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'ttt.log' }),
  ],
});

const application = express();

if (!('INFERKIT_API_KEY' in process.env)) {
  logger.error('Cannot continue without an InferKit API key.', () => {
    process.exit(1);
  });
}

application.set('view engine', 'pug');

application.use(express.static(`${__dirname}/static`));

application.use(express.json());

application.get('/', (request, response) => {
  response.render('index', {
    title: "Talk to Transformer",
  });
});

logger.info("Starting server");

const server = new websocket.server({
  httpServer: application.listen(8011),
});

server.on('request', (request) => {
  const connection = request.accept(null, request.origin);
  logger.info("Connection accepted");

  connection.on('message', function({ utf8Data: rawData }) {
    const data = JSON.parse(rawData);

    const promptText = data.promptText;
    const isContinuation = data.isContinuation || false;

    logger.info("Prompt text: %s", promptText);
    logger.info("Is continuation: %s", isContinuation);

    const apiRequestData = JSON.stringify({
      prompt: {
        text: promptText,
        isContinuation: isContinuation,
      },
      streamResponse: true,
      length: 100,
    });
    const apiRequest = https.request({
      hostname: 'api.inferkit.com',
      path: '/v1/models/standard/generate',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.INFERKIT_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(apiRequestData),
      }
    }, (apiResponse) => {
      logger.debug("Got response: %o", apiResponse);

      apiResponse.on('data', (rawChunk) => {
        const textChunk = rawChunk.toString('utf-8');
        let chunk = null;
        try {
          chunk = JSON.parse(textChunk);
        }
        catch (error) {
          logger.error(error);
        }

        if (chunk !== null) {
          logger.info("Chunk received: %o", chunk);
          if (chunk.data !== undefined) {
            const data = chunk.data;
            if (data.text.length > 0) {
              connection.sendUTF(data.text);
            }
            if (data.isFinalChunk) {
              connection.close();
            }
          }
        }
        else {
          logger.error("Could not parse chunk: %s", textChunk);
          connection.close();
        }
      });

      apiResponse.on('finish', () => {
        connection.close();
      });

      apiResponse.on('close', () => {
        connection.close();
      });
    });

    apiRequest.on('error', (error) => {
      logger.warn("Got error: %o", error);
      connection.close();
    });

    apiRequest.write(apiRequestData);
    apiRequest.end();
  });
});

