const { createLogger, format, transports } = require('winston');
const path = require('path');

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: 'kidsafe-tracker-backend' },
  transports: [
    // Write all logs with importance level of `error` or less to `error.log`
    new transports.File({ 
      filename: path.join(__dirname, '../../logs/error.log'), 
      level: 'error' 
    }),
    // Write all logs with importance level of `info` or less to `combined.log`
    new transports.File({ 
      filename: path.join(__dirname, '../../logs/combined.log') 
    })
  ]
});

// If we're not in production, log to the console with custom colorized format
if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({
    format: format.combine(
      format.colorize(),
      format.simple(),
      format.printf(({ level, message, timestamp, service, ...metadata }) => {
        let msg = `${timestamp} [${level}]: ${message}`;
        if (Object.keys(metadata).length > 0 && metadata.service) {
          delete metadata.service;
        }
        if (Object.keys(metadata).length > 0) {
          msg += ` ${JSON.stringify(metadata)}`;
        }
        return msg;
      })
    )
  }));
}

module.exports = logger;
