import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { LoggerBot } from '../bot/logger-bot';

@Catch()
@Injectable()
export class AllExceptionsFilter
  implements ExceptionFilter {
  private readonly logger = new Logger(
    AllExceptionsFilter.name,
  );

  catch(
    exception: unknown,
    host: ArgumentsHost,
  ) {
    const ctx = host.switchToHttp();

    const response =
      ctx.getResponse<Response>();

    const request =
      ctx.getRequest<Request>();

    let statusCode =
      HttpStatus.INTERNAL_SERVER_ERROR;

    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'Internal server error';
    let details: unknown;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();

      code =
        HttpStatus[statusCode] ??
        'HTTP_ERROR';

      const exceptionResponse =
        exception.getResponse();

      if (
        typeof exceptionResponse === 'string'
      ) {
        message = exceptionResponse;
      }

      if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const data =
          exceptionResponse as {
            error?: string;
            code?: string;
            message?: string | string[];
            details?: unknown;
          };

        code =
          data.code ??
          data.error ??
          code;

        if (typeof data.message === 'string') {
          message = data.message;
        } else if (Array.isArray(data.message)) {
          message = data.message.join(', ');
        }

        details = data.details;
      }
    }

    const errorStack =
      exception instanceof Error
        ? exception.stack
        : JSON.stringify(exception);

    this.logger.error(
      `${request.method} ${request.url} -> ${statusCode} ${message}`,
      errorStack,
    );

    if (statusCode == 400 || statusCode == 500) {
      const telegramMessage =
        this.buildTelegramMessage({
          request,
          statusCode,
          code,
          message,
          details,
          errorStack,
        });

      void LoggerBot.sendMessage(
        telegramMessage,
      );
    }

    response.status(statusCode).json({
      statusCode,
      code,
      message,
      ...(details !== undefined
        ? { details }
        : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private buildTelegramMessage(data: {
    request: Request;
    statusCode: number;
    code: string;
    message: string;
    details?: unknown;
    errorStack?: string;
  }): string {
    const {
      request,
      statusCode,
      code,
      message,
      details,
      errorStack,
    } = data;

    const method = this.escapeHtml(
      request.method,
    );

    const path = this.escapeHtml(
      request.originalUrl ??
      request.url,
    );

    const safeCode = this.escapeHtml(code);

    const safeMessage = this.escapeHtml(
      message,
    );

    const ip = this.escapeHtml(
      request.ip ?? 'unknown',
    );

    const userAgent = this.escapeHtml(
      request.headers['user-agent'] ??
      'unknown',
    );

    const detailsText =
      details !== undefined
        ? this.safeJson(details)
        : 'N/A';

    const stackText =
      errorStack ?? 'No stack trace';

    const fullMessage = [
      '🚨 <b>BACKEND ERROR</b>',
      '',
      `<b>Status:</b> ${statusCode}`,
      `<b>Code:</b> ${safeCode}`,
      `<b>Method:</b> ${method}`,
      `<b>Path:</b> <code>${path}</code>`,
      `<b>IP:</b> ${ip}`,
      '',
      `<b>Message:</b> ${safeMessage}`,
      '',
      `<b>Details:</b>`,
      `<pre>${this.escapeHtml(detailsText)}</pre>`,
      '',
      `<b>Stack:</b>`,
      `<pre>${this.escapeHtml(stackText)}</pre>`,
      '',
      `<b>User-Agent:</b>`,
      `<pre>${userAgent}</pre>`,
      '',
      `<b>Time:</b> ${new Date().toISOString()}`,
    ].join('\n');
    return fullMessage.slice(0, 3900);
  }

  private safeJson(value: unknown): string {
    try {
      return JSON.stringify(
        value,
        null,
        2,
      );
    } catch {
      return String(value);
    }
  }

  private escapeHtml(value: unknown): string {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}