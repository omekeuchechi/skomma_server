import type { FastifyInstance } from 'fastify';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { requireAuth } from '@/middleware/auth';
import { db } from '@/database/client';
import { ok, fail } from '@/utils/response';

const friendRequestSchema = z.object({
  friendId: z.string(),
});

export default async function friendsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/friends/me', { preHandler: requireAuth }, async (request, reply) => {
    const userId = new ObjectId(request.userId);
    const docs = await db.collection('friends').find({
      $or: [{ userId }, { friendId: userId }],
    }).toArray();

    const items = docs.map((doc) => ({
      id: doc._id.toHexString(),
      ...doc,
      friendId: doc.friendId.toHexString(),
      userId: doc.userId.toHexString(),
    }));
    return ok(reply, items, 'Friends');
  });

  app.post('/friends/requests', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = friendRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return fail(reply, 'Invalid friend request', 400);
    }
    if (!ObjectId.isValid(parsed.data.friendId)) {
      return fail(reply, 'Invalid friend id', 400);
    }

    const friendId = new ObjectId(parsed.data.friendId);
    const target = await db.collection('users').findOne({ _id: friendId });
    if (!target) {
      return fail(reply, 'User not found', 404);
    }

    const userId = new ObjectId(request.userId);
    const existing = await db.collection('friends').findOne({
      $or: [
        { userId, friendId },
        { userId: friendId, friendId: userId },
      ],
    });
    if (existing) {
      return fail(reply, 'Friend relation already exists', 409);
    }

    const result = await db.collection('friends').insertOne({
      userId,
      friendId,
      status: 'pending',
      createdAt: new Date(),
    });

    return ok(reply, { id: result.insertedId.toHexString(), status: 'pending' }, 'Friend request sent', 201);
  });
}
