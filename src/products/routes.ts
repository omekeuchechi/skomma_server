import type { FastifyInstance } from 'fastify';
import { ObjectId } from 'mongodb';
import { db } from '@/database/client';
import { ok, fail } from '@/utils/response';

function pagination(query: unknown): { page: number; limit: number; skip: number } {
  const q = query as { page?: string; limit?: string };
  const page = Math.max(1, Number(q.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(q.limit ?? 20)));
  return { page, limit, skip: (page - 1) * limit };
}

export default async function productsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/products', async (request, reply) => {
    const { page, limit, skip } = pagination(request.query);
    const filter = { isActive: true };

    const [total, items] = await Promise.all([
      db.collection('products').countDocuments(filter),
      db.collection('products').find(filter).skip(skip).limit(limit).toArray(),
    ]);

    return ok(reply, { items, page, limit, total }, 'Products');
  });

  app.get('/products/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!ObjectId.isValid(id)) {
      return fail(reply, 'Invalid product id', 400);
    }

    const doc = await db.collection('products').findOne({ _id: new ObjectId(id) });
    if (!doc) {
      return fail(reply, 'Product not found', 404);
    }

    return ok(reply, { id: doc._id.toHexString(), ...doc }, 'Product');
  });
}
