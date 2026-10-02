import type { FastifyInstance } from 'fastify';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { requireAuth } from '@/middleware/auth';
import { db } from '@/database/client';
import { ok, fail } from '@/utils/response';

const listingSchema = z.object({
  shopId: z.string(),
  categoryId: z.string().optional(),
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  price: z.number().positive(),
  stock: z.number().int().min(0).default(0),
  imageUrl: z.string().url().optional(),
});

export default async function marketplaceRoutes(app: FastifyInstance): Promise<void> {
  app.get('/marketplace/listings', async (request, reply) => {
    const q = request.query as { page?: string; limit?: string; shopId?: string };
    const page = Math.max(1, Number(q.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(q.limit ?? 20)));

    const filter: Record<string, unknown> = { isActive: true };
    if (q.shopId && ObjectId.isValid(q.shopId)) {
      filter.shopId = new ObjectId(q.shopId);
    }

    const [total, items] = await Promise.all([
      db.collection('products').countDocuments(filter),
      db.collection('products')
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
    ]);

    return ok(reply, { items, page, limit, total }, 'Marketplace listings');
  });

  app.post('/marketplace/listings', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = listingSchema.safeParse(request.body);
    if (!parsed.success) {
      return fail(reply, 'Invalid listing payload', 400);
    }

    const shop = await db.collection('shops').findOne({
      _id: new ObjectId(parsed.data.shopId),
      ownerId: new ObjectId(request.userId),
    });
    if (!shop) {
      return fail(reply, 'Shop not found or not owned by you', 403);
    }

    const existing = await db.collection('products').findOne({ slug: parsed.data.slug });
    if (existing) {
      return fail(reply, 'Slug already in use', 409);
    }

    const now = new Date();
    const result = await db.collection('products').insertOne({
      ...parsed.data,
      shopId: new ObjectId(parsed.data.shopId),
      categoryId: parsed.data.categoryId ? new ObjectId(parsed.data.categoryId) : undefined,
      createdAt: now,
      updatedAt: now,
    });

    return ok(reply, { id: result.insertedId.toHexString() }, 'Listing created', 201);
  });
}
