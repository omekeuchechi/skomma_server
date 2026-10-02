import pino, { type Logger, type LoggerOptions } from 'pino';
import { env } from '@/config/env';

const isProduction = env.NODE_ENV === 'production';

export const loggerOptions: LoggerOptions = {
  level: env.LOG_LEVEL,
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard' },
      },
};

export const logger: Logger = pino(loggerOptions);
