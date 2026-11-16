import type { FastifyInstance } from 'fastify';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { requireAuth } from '@/middleware/auth';
import { db } from '@/database/client';
import { ok, fail } from '@/utils/response';

const shopSchema = z.object({
  shopName: z.string().min(1).max(100),
  plotId: z.string().optional(),
  theme: z.string().optional(),
});

const updateShopSchema = z.object({
  shopName: z.string().min(1).max(100).optional(),
  theme: z.string().optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'EXPIRED']).optional(),
});

export default async function shopsRoutes(app: FastifyInstance): Promise<void> {
  // Get all shops
  app.get('/shops', async (request, reply) => {
    const q = request.query as { page?: string; limit?: string; ownerId?: string };
    const page = Math.max(1, Number(q.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(q.limit ?? 20)));

    const filter: Record<string, unknown> = {};
    if (q.ownerId && ObjectId.isValid(q.ownerId)) {
      filter.ownerId = new ObjectId(q.ownerId);
    }

    const [total, items] = await Promise.all([
      db.collection('shops').countDocuments(filter),
      db.collection('shops')
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
    ]);

    return ok(reply, { items, page, limit, total }, 'Shops');
  });

  // Get shop by ID
  app.get('/shops/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!ObjectId.isValid(id)) {
      return fail(reply, 'Invalid shop id', 400);
    }

    const shop = await db.collection('shops').findOne({ _id: new ObjectId(id) });
    if (!shop) {
      return fail(reply, 'Shop not found', 404);
    }

    return ok(reply, { id: shop._id.toHexString(), ...shop }, 'Shop');
  });

  // Create shop (admin only)
  app.post('/shops', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = shopSchema.safeParse(request.body);
    if (!parsed.success) {
      return fail(reply, 'Invalid shop payload', 400);
    }

    const now = new Date();
    const renewalDate = new Date();
    renewalDate.setFullYear(renewalDate.getFullYear() + 1);

    const result = await db.collection('shops').insertOne({
      ...parsed.data,
      ownerId: null,
      status: 'ACTIVE',
      renewalDate,
      createdAt: now,
      updatedAt: now,
    });

    return ok(reply, { id: result.insertedId.toHexString() }, 'Shop created', 201);
  });

  // Update shop (owner only)
  app.put('/shops/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!ObjectId.isValid(id)) {
      return fail(reply, 'Invalid shop id', 400);
    }

    const parsed = updateShopSchema.safeParse(request.body);
    if (!parsed.success) {
      return fail(reply, 'Invalid update payload', 400);
    }

    const shop = await db.collection('shops').findOne({ _id: new ObjectId(id) });
    if (!shop) {
      return fail(reply, 'Shop not found', 404);
    }

    // Only owner or admin can update
    if (shop.ownerId && shop.ownerId.toString() !== request.userId) {
      return fail(reply, 'Not authorized to update this shop', 403);
    }

    const result = await db.collection('shops').updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...parsed.data, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return fail(reply, 'Shop not found', 404);
    }

    return ok(reply, { id }, 'Shop updated');
  });

  // Delete shop (admin only)
  app.delete('/shops/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!ObjectId.isValid(id)) {
      return fail(reply, 'Invalid shop id', 400);
    }

    const result = await db.collection('shops').deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return fail(reply, 'Shop not found', 404);
    }

    return ok(reply, { id }, 'Shop deleted');
  });
}
