import type { FastifyInstance } from 'fastify';
import { ObjectId } from 'mongodb';
import { requireAuth } from '@/middleware/auth';
import { db } from '@/database/client';
import { ok, fail } from '@/utils/response';

export default async function notificationsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/notifications/me', { preHandler: requireAuth }, async (request, reply) => {
    const docs = await db.collection('notifications')
      .find({ userId: new ObjectId(request.userId) })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    const items = docs.map((doc) => ({ id: doc._id.toHexString(), ...doc }));
    return ok(reply, items, 'Notifications');
  });

  app.patch('/notifications/:id/read', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!ObjectId.isValid(id)) {
      return fail(reply, 'Invalid notification id', 400);
    }

    const result = await db.collection('notifications').updateOne(
      { _id: new ObjectId(id), userId: new ObjectId(request.userId) },
      { $set: { read: true } },
    );
    if (result.matchedCount === 0) {
      return fail(reply, 'Notification not found', 404);
    }

    return ok(reply, { id }, 'Notification marked as read');
  });
}
