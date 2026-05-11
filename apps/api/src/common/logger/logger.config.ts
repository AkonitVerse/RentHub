import { randomUUID } from 'crypto';
import type { Params } from 'nestjs-pino';
import type { IncomingMessage } from 'http';

export function buildLoggerConfig(): Params {
  const isProduction = process.env.NODE_ENV === 'production';
  const level = process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug');

  return {
    pinoHttp: {
      level,
      genReqId: (req: IncomingMessage) => {
        const headerId = req.headers['x-request-id'];
        if (typeof headerId === 'string' && headerId.length > 0) {
          return headerId;
        }
        return randomUUID();
      },
      customProps: (req) => ({
        requestId: (req as IncomingMessage & { id?: string }).id,
      }),
      autoLogging: {
        ignore: (req: IncomingMessage) => {
          const url = req.url ?? '';
          return url.startsWith('/api/v1/health') || url === '/favicon.ico';
        },
      },
      serializers: {
        req: (req) => ({
          id: req.id,
          method: req.method,
          url: req.url,
        }),
        res: (res) => ({
          statusCode: res.statusCode,
        }),
      },
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers["x-api-key"]',
          'res.headers["set-cookie"]',
          '*.password',
          '*.token',
          '*.refreshToken',
          '*.accessToken',
        ],
        remove: true,
      },
      transport: isProduction
        ? undefined
        : {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:HH:MM:ss',
              ignore: 'pid,hostname,req,res,responseTime',
              messageFormat: '{context} {msg}',
            },
          },
    },
  };
}
