import type { FastifyReply } from 'fastify';

export interface ApiResponse<T> {
  status: 'success' | 'error';
  message: string;
  data: T;
}

export interface ApiErrorResponse {
  status: 'error';
  message: string;
  statusCode: number;
  errors?: Array<{ field?: string; message: string }>;
}

export function ok<T>(reply: FastifyReply, data: T, message = 'success', code = 200): FastifyReply {
  const body: ApiResponse<T> = { status: 'success', message, data };
  return reply.code(code).send(body);
}

export function fail(
  reply: FastifyReply,
  message: string,
  code = 400,
  errors?: Array<{ field?: string; message: string }>,
): FastifyReply {
  const body: ApiErrorResponse = { status: 'error', message, statusCode: code, errors };
  return reply.code(code).send(body);
}
