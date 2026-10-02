import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '@/middleware/auth';
import { db } from '@/database/client';
import { ok, fail } from '@/utils/response';

const trackSchema = z.object({
  event: z.string().min(1).max(80),
  sessionId: z.string().optional(),
  metadata: z.string().max(4000).optional(),
});

export default async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/analytics/overview', { preHandler: requireAuth }, async (_request, reply) => {
    const [users, products, orders, npcs] = await Promise.all([
      db.collection('users').countDocuments(),
      db.collection('products').countDocuments(),
      db.collection('orders').countDocuments(),
      db.collection('npcs').countDocuments(),
    ]);

    return ok(reply, { users, products, orders, npcs }, 'Analytics overview');
  });

  app.post('/analytics/track', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = trackSchema.safeParse(request.body);
    if (!parsed.success) {
      return fail(reply, 'Invalid analytics payload', 400);
    }

    await db.collection('analytics_events').insertOne({
      event: parsed.data.event,
      userId: request.userId,
      sessionId: parsed.data.sessionId ?? null,
      metadata: parsed.data.metadata ?? null,
      createdAt: new Date(),
    });

    return ok(reply, null, 'Event tracked', 201);
  });
}
