import { resolve } from 'path';
import { createLogger, format, transports } from 'winston';

export const Logger = createLogger({
  level: 'info',
  format: format.simple(),
  transports: [
    new transports.File({ filename: resolve(__dirname, './error.log'), level: 'error' }),
    new transports.File({ filename: resolve(__dirname, './info.log'), level: 'info' })
  ]
});
