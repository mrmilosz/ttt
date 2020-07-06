const deepmerge = require('deepmerge');
const express = require('express');
const fetch = require('node-fetch');
const stream = require('stream');
const websocket = require('websocket');
const util = require('util');
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

if (!('ORIGIN' in process.env)) {
  logger.error('Cannot continue without an origin.', () => {
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
  if (request.origin !== process.env.ORIGIN) {
    return;
  }
  logger.info("Accepting client connection from %s", request.origin);
  const connection = request.accept(null, request.origin);

  connection.on('message', async ({ utf8Data: rawRequestData }) => {
    try {
      const apiRequestData = deepmerge({
        prompt: {
          text: " ",
          isContinuation: false,
        },
        streamResponse: true,
        length: 100,
      }, JSON.parse(rawRequestData));

      logger.info("Sending request data: %o", apiRequestData);

      const apiResponse = await fetch('https://api.inferkit.com/v1/models/standard/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.INFERKIT_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiRequestData)
      });

      for await (const rawLinesBytes of apiResponse.body) {
        const rawLines = rawLinesBytes.toString('utf-8');
        logger.info("Received response part: %o", rawLines);
        for (const rawLine of rawLines.split('\n')) {
          if (rawLine.length > 0) {
            const chunk = JSON.parse(rawLine).data;
            connection.sendUTF(JSON.stringify({
              text: chunk.text,
            }));
          }
        }
      }
    }
    catch (error) {
      connection.sendUTF(JSON.stringify({
        error: "Server error",
      }));
    }
    finally {
      logger.info("Closing client connection from %s", request.origin);
      connection.close();
    }
  });
});

