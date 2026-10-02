import Fastify from 'fastify';
import { loggerOptions } from '@/utils/logger';
import { env } from '@/config/env';
import registerCors from '@/plugins/cors';
import registerWebsocket from '@/plugins/websocket';
import jwt from '@fastify/jwt';
import registerRoutes from '@/routes';
import { errorHandler } from '@/middleware/errorHandler';
import { notFoundHandler } from '@/middleware/notFound';

export async function buildApp(): Promise<ReturnType<typeof Fastify>> {
  const app = Fastify({
    logger: loggerOptions,
  });

  // Add CORS headers globally
  app.addHook('onRequest', async (_request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  });

  // Register CORS plugin (for OPTIONS handling)
  await app.register(registerCors);

  app.setErrorHandler(errorHandler);

  await app.register(jwt, { secret: env.JWT_SECRET });
  await app.register(registerWebsocket);

  await app.register(registerRoutes, { prefix: env.PREFIX });

  app.setNotFoundHandler(notFoundHandler);

  return app;
}
