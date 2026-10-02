import type { FastifyInstance } from 'fastify';
import { ObjectId } from 'mongodb';
import { requireAuth } from '@/middleware/auth';
import { db } from '@/database/client';
import { ok, fail } from '@/utils/response';

export default async function inventoryRoutes(app: FastifyInstance): Promise<void> {
  interface InventoryDoc {
    items: Array<{ productId: ObjectId; name: string; quantity: number; slot: string }>;
  }

  app.get('/inventory/me', { preHandler: requireAuth }, async (request, reply) => {
    const doc = await db.collection('inventories').findOne({ ownerId: new ObjectId(request.userId) });
    if (!doc) {
      return ok(reply, { ownerId: request.userId, capacity: 100, items: [] }, 'Empty inventory');
    }

    return ok(reply, { ...doc, id: doc._id.toHexString() }, 'Inventory');
  });

  app.post('/inventory/me/items', { preHandler: requireAuth }, async (request, reply) => {
    const body = request.body as { productId?: string; name?: string; quantity?: number; slot?: string };
    if (!body.productId || !body.name || !body.quantity) {
      return fail(reply, 'productId, name and quantity are required', 400);
    }

    const result = await db.collection<InventoryDoc>('inventories').findOneAndUpdate(
      { ownerId: new ObjectId(request.userId) },
      {
        $push: {
          items: {
            productId: new ObjectId(body.productId),
            name: body.name,
            quantity: Math.max(1, body.quantity),
            slot: body.slot ?? 'general',
          },
        },
        $setOnInsert: { capacity: 100 },
        $set: { updatedAt: new Date() },
      },
      { upsert: true, returnDocument: 'after' },
    );

    return ok(reply, result, 'Item added to inventory', 201);
  });
}
