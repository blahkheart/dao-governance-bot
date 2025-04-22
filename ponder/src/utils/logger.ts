import winston from 'winston';
import 'winston-daily-rotate-file';

// List of sensitive keys to redact
const SENSITIVE_KEYS = [
  'api_key',
  'apikey',
  'key',
  'secret',
  'password',
  'token',
  'mnemonic',
  'uuid',
  'authorization'
];

// Function to redact sensitive information
const redactSensitiveInfo = (info: any): any => {
  if (typeof info === 'object' && info !== null) {
    const redacted = { ...info };
    
    Object.keys(redacted).forEach(key => {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.some(sensitive => lowerKey.includes(sensitive))) {
        redacted[key] = '[REDACTED]';
      } else if (typeof redacted[key] === 'object') {
        redacted[key] = redactSensitiveInfo(redacted[key]);
      } else if (typeof redacted[key] === 'string') {
        // Redact API keys and URLs containing API keys
        redacted[key] = redacted[key].replace(
          /(https?:\/\/[^\/]*\/v[0-9]+\/[^\/]*\/)[a-zA-Z0-9]{30,}/g,
          '$1[REDACTED]'
        );
      }
    });
    return redacted;
  }
  return info;
};

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format(redactSensitiveInfo)(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true
    }),
    new winston.transports.DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true
    })
  ]
});

export type Logger = typeof logger; 