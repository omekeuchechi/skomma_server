import type { FastifyReply, FastifyRequest } from 'fastify';

export function notFoundHandler(request: FastifyRequest, reply: FastifyReply): void {
  reply.code(404).send({
    status: 'error',
    message: `Route ${request.method} ${request.url} not found`,
    statusCode: 404,
  });
}
