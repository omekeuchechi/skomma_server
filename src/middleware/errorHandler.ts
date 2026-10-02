import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  request.log.error({ err: error }, error.message);

  const statusCode = error.statusCode ?? 500;
  const message =
    statusCode >= 500
      ? 'Internal server error'
      : (error.message ?? 'Request failed');

  reply.code(statusCode).send({
    status: 'error',
    message,
    statusCode,
  });
}
