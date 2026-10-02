import type { FastifyReply, FastifyRequest } from 'fastify';

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    await request.jwtVerify();
    request.userId = request.user.sub;
  } catch {
    reply.code(401).send({
      status: 'error',
      message: 'Unauthorized: missing or invalid access token',
      statusCode: 401,
    });
  }
}