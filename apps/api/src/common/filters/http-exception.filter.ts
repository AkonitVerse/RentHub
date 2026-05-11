import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { Sentry, sentryEnabled } from '../../instrument';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Внутренняя ошибка сервера';
    let code: string | undefined;
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, unknown>;
        message = (r.message as string | string[]) ?? exception.message;
        code = r.error as string | undefined;
        details = r.details;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        message = 'Запись с такими данными уже существует';
        code = 'UNIQUE_CONSTRAINT';
        details = exception.meta;
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = 'Запись не найдена';
        code = 'NOT_FOUND';
      } else if (exception.code === 'P2010') {
        status = HttpStatus.CONFLICT;
        const meta = exception.meta as { code?: string; message?: string } | undefined;
        const pgMessage = meta?.message ?? exception.message;
        if (pgMessage.includes('reservations_no_overlap') || pgMessage.includes('exclusion')) {
          message = 'Конфликт резервирования: единица занята на пересекающийся период';
          code = 'RESERVATION_OVERLAP';
        } else {
          message = pgMessage;
          code = exception.code;
        }
        details = meta;
      } else {
        status = HttpStatus.BAD_REQUEST;
        message = `Ошибка базы данных: ${exception.message}`;
        code = exception.code;
        details = exception.meta;
      }
      this.logger.error(`Prisma ${exception.code}: ${exception.message}`, exception.stack);
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(exception.message, exception.stack);
    }

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : undefined,
      );
      if (sentryEnabled) {
        Sentry.captureException(exception, {
          tags: {
            method: request.method,
            path: request.url,
            statusCode: String(status),
          },
          extra: {
            requestId: (request as Request & { id?: string }).id,
          },
        });
      }
    }

    response.status(status).json({
      statusCode: status,
      message,
      code,
      details,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
