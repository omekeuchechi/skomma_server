import type { FastifyInstance } from 'fastify';
import { db } from '@/database/client';
import { ok } from '@/utils/response';

export default async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_request, reply) => {
    let database: 'ok' | 'unreachable' = 'ok';
    try {
      await db.command({ ping: 1 });
    } catch {
      database = 'unreachable';
    }

    return ok(
      reply,
      {
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        database,
      },
      'Service healthy',
    );
  });

  app.get('/health/ready', async (_request, reply) => {
    return ok(reply, { ready: true }, 'Ready');
  });
}
