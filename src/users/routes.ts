import type { FastifyInstance } from 'fastify';
import { ObjectId } from 'mongodb';
import { requireAuth } from '@/middleware/auth';
import { db } from '@/database/client';
import { ok, fail } from '@/utils/response';

export default async function usersRoutes(app: FastifyInstance): Promise<void> {
  app.get('/users/me', { preHandler: requireAuth }, async (request, reply) => {
    const doc = await db.collection('users').findOne({ _id: new ObjectId(request.userId) });
    if (!doc) {
      return fail(reply, 'User not found', 404);
    }

    const { _id, passwordHash: _passwordHash, ...rest } = doc;
    return ok(reply, { id: _id.toHexString(), ...rest }, 'Current user');
  });

  app.get('/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!ObjectId.isValid(id)) {
      return fail(reply, 'Invalid user id', 400);
    }

    const doc = await db.collection('users').findOne(
      { _id: new ObjectId(id) },
      { projection: { passwordHash: 0 } },
    );
    if (!doc) {
      return fail(reply, 'User not found', 404);
    }

    return ok(reply, { id: doc._id.toHexString(), ...doc }, 'User profile');
  });
}
