import jwt from '@fastify/jwt';
import type { FastifyInstance } from 'fastify';
import { env } from '@/config/env';

export default async function registerJwt(app: FastifyInstance): Promise<void> {
  try {
    await app.register(jwt, {
      secret: env.JWT_SECRET,
    });

    // Verify the plugin is attached
    app.log.info({ jwtAvailable: !!app.jwt }, 'JWT plugin registered successfully');
  } catch (error) {
    app.log.error({ error }, 'Failed to register JWT plugin');
    throw error;
  }
}
