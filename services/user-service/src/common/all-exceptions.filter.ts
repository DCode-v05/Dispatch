import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | object = 'Internal server error';
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      message =
        typeof res === 'string'
          ? res
          : ((res as Record<string, unknown>).message ?? res);
    }

    const requestId = (request.headers['x-request-id'] as string) || undefined;

    if (status >= 500) {
      this.logger.error(
        JSON.stringify({
          requestId,
          method: request.method,
          url: request.url,
          status,
          error:
            exception instanceof Error ? exception.message : String(exception),
          stack: exception instanceof Error ? exception.stack : undefined,
        }),
      );
    } else {
      this.logger.warn(
        JSON.stringify({
          requestId,
          method: request.method,
          url: request.url,
          status,
          message,
        }),
      );
    }

    const safeMessage =
      status >= 500 && process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : message;

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId,
      message: safeMessage,
    });
  }
}
