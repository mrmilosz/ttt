const express = require('express');
const https = require('https');
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

application.post('/generate', (request, response) => {
  const promptText = request.body.promptText;
  logger.info("Prompt text: %s", promptText);
  const data = JSON.stringify({
    prompt: {
      text: promptText,
      isContinuation: false,
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
      'Content-Length': Buffer.byteLength(data),
    }
  }, (apiResponse) => {
    logger.debug("Got response: %o", apiResponse);

    response.setHeader('Content-Type', 'text/html; charset=utf-8'); // This is a lie, but it forces the browser to actually stream...
    response.setHeader('Transfer-Encoding', 'chunked');
    response.flushHeaders();

    apiResponse.on('data', (rawChunk) => {
      const textChunk = rawChunk.toString('utf-8');
      let chunk = null;
      try {
        chunk = JSON.parse(textChunk).data
      }
      catch (error) {
        logger.error(error);
      }

      if (chunk !== null) {
        logger.info("Data parses to: %o", chunk);
        if (chunk.text.length > 0) {
          response.write(chunk.text);
          response.flush();
        }
        if (chunk.isFinalChunk) {
          response.end();
        }
      }
      else {
        logger.error("Could not parse chunk: %s", textChunk);
      }
    });
    apiResponse.on('finish', () => {
      response.end();
    });
    apiResponse.on('close', () => {
      response.end();
    });
  });

  apiRequest.on('error', (error) => {
    logger.warn("Got error: %o", error);
    response.send("Error");
  });

  apiRequest.write(data);
  apiRequest.end();
});

logger.info("Starting server");

const server = application.listen(8011);
