import type { FastifyInstance } from 'fastify';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { requireAuth } from '@/middleware/auth';
import { db } from '@/database/client';
import { ok, fail } from '@/utils/response';

const shopkeeperSchema = z.object({
  shopIds: z.array(z.string()).optional(),
  balance: z.number().optional(),
  earnings: z.number().optional(),
  reputation: z.number().min(0).max(5).optional(),
  shopTier: z.enum(['BRONZE', 'SILVER', 'GOLD']).optional(),
});

export default async function shopkeepersRoutes(app: FastifyInstance): Promise<void> {
  // Get current user's shopkeeper profile
  app.get('/shopkeepers/me', { preHandler: requireAuth }, async (request, reply) => {
    const shopkeeper = await db.collection('shopkeepers').findOne({
      userId: new ObjectId(request.userId),
    });

    if (!shopkeeper) {
      return fail(reply, 'Shopkeeper profile not found', 404);
    }

    return ok(reply, { id: shopkeeper._id.toHexString(), ...shopkeeper }, 'Shopkeeper');
  });

  // Get shopkeeper by ID
  app.get('/shopkeepers/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!ObjectId.isValid(id)) {
      return fail(reply, 'Invalid shopkeeper id', 400);
    }

    const shopkeeper = await db.collection('shopkeepers').findOne({ _id: new ObjectId(id) });
    if (!shopkeeper) {
      return fail(reply, 'Shopkeeper not found', 404);
    }

    return ok(reply, { id: shopkeeper._id.toHexString(), ...shopkeeper }, 'Shopkeeper');
  });

  // Create shopkeeper profile
  app.post('/shopkeepers', { preHandler: requireAuth }, async (request, reply) => {
    const existing = await db.collection('shopkeepers').findOne({
      userId: new ObjectId(request.userId),
    });

    if (existing) {
      return fail(reply, 'Shopkeeper profile already exists', 409);
    }

    const parsed = shopkeeperSchema.safeParse(request.body);
    if (!parsed.success) {
      return fail(reply, 'Invalid shopkeeper payload', 400);
    }

    const now = new Date();
    const result = await db.collection('shopkeepers').insertOne({
      userId: new ObjectId(request.userId),
      shopIds: (parsed.data.shopIds?.map((id) => new ObjectId(id)) || []) as any,
      balance: parsed.data.balance || 0,
      earnings: parsed.data.earnings || 0,
      reputation: parsed.data.reputation || 0,
      shopTier: parsed.data.shopTier || 'BRONZE',
      membershipStatus: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });

    return ok(reply, { id: result.insertedId.toHexString() }, 'Shopkeeper created', 201);
  });

  // Update shopkeeper profile
  app.put('/shopkeepers/me', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = shopkeeperSchema.partial().safeParse(request.body);
    if (!parsed.success) {
      return fail(reply, 'Invalid update payload', 400);
    }

    const updateData: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
    if (parsed.data.shopIds) {
      updateData.shopIds = parsed.data.shopIds.map((id) => new ObjectId(id)) as any;
    }

    const result = await db.collection('shopkeepers').updateOne(
      { userId: new ObjectId(request.userId) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return fail(reply, 'Shopkeeper profile not found', 404);
    }

    return ok(reply, { success: true }, 'Shopkeeper updated');
  });

  // Get shopkeeper's inventory
  app.get('/shopkeepers/me/inventory', { preHandler: requireAuth }, async (request, reply) => {
    const shopkeeper = await db.collection('shopkeepers').findOne({
      userId: new ObjectId(request.userId),
    });

    if (!shopkeeper) {
      return fail(reply, 'Shopkeeper profile not found', 404);
    }

    const inventory = await db.collection('inventory')
      .find({ userId: new ObjectId(request.userId) })
      .toArray();

    return ok(reply, { items: inventory }, 'Inventory');
  });
}
