import type { FastifyInstance } from 'fastify';
import { ObjectId } from 'mongodb';
import { db } from '@/database/client';
import { ok, fail } from '@/utils/response';

export default async function npcRoutes(app: FastifyInstance): Promise<void> {
  app.get('/npc/:areaId', async (request, reply) => {
    const { areaId } = request.params as { areaId: string };
    if (!ObjectId.isValid(areaId)) {
      return fail(reply, 'Invalid area id', 400);
    }

    const docs = await db.collection('npcs')
      .find({ areaId: new ObjectId(areaId) })
      .sort({ name: 1 })
      .toArray();

    const items = docs.map((doc) => ({ id: doc._id.toHexString(), ...doc }));
    return ok(reply, items, 'NPCs in area');
  });
}
