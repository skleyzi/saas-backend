import { Prisma } from '@db/client';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';

interface HttpExceptionResponse {
  message: string | string[];
  error: string;
  statusCode: number;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly fieldLabels: Record<string, string> = {
    email: 'Email address',
  };

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const prismaHandled = this.handlePrismaError(exception);
      status = prismaHandled.status;
      message = prismaHandled.message;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'object'
          ? (exceptionResponse as HttpExceptionResponse).message
          : exceptionResponse;
    }

    if (status >= 500) {
      request.log.error(
        { err: exception, body: request.body },
        'Unhandled Exception',
      );
    } else {
      request.log.warn({ message, body: request.body }, 'Client Error');
    }

    response.status(status).send({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: Array.isArray(message) ? message[0] : message,
    });
  }

  private handlePrismaError(error: Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': {
        const target = error.meta?.target as string[] | undefined;
        const field = target ? target[0] : null;
        const label = field ? this.fieldLabels[field] : 'Field';
        return {
          status: HttpStatus.CONFLICT,
          message: `${label} is already in use`,
        };
      }
      case 'P2025': {
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'Record not found',
        };
      }
      case 'P2003': {
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Foreign key constraint failed',
        };
      }
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Database error',
        };
    }
  }
}
