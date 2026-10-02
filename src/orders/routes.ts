import type { FastifyInstance } from 'fastify';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { requireAuth } from '@/middleware/auth';
import { db } from '@/database/client';
import { ok, fail } from '@/utils/response';

const lineSchema = z.object({
  productId: z.string(),
  title: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
});

const createOrderSchema = z.object({
  lines: z.array(lineSchema).min(1),
  shippingAddressId: z.string().optional(),
});

export default async function ordersRoutes(app: FastifyInstance): Promise<void> {
  app.get('/orders/me', { preHandler: requireAuth }, async (request, reply) => {
    const docs = await db.collection('orders')
      .find({ userId: new ObjectId(request.userId) })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    const items = docs.map((doc) => ({ id: doc._id.toHexString(), ...doc }));
    return ok(reply, items, 'Orders');
  });

  app.post('/orders', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = createOrderSchema.safeParse(request.body);
    if (!parsed.success) {
      return fail(reply, 'Invalid order payload', 400);
    }

    const total = parsed.data.lines.reduce(
      (sum, line) => sum + line.unitPrice * line.quantity,
      0,
    );

    const now = new Date();
    const result = await db.collection('orders').insertOne({
      userId: new ObjectId(request.userId),
      lines: parsed.data.lines.map((line) => ({
        productId: new ObjectId(line.productId),
        title: line.title,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      })),
      total,
      status: 'pending',
      shippingAddressId: parsed.data.shippingAddressId
        ? new ObjectId(parsed.data.shippingAddressId)
        : undefined,
      createdAt: now,
      updatedAt: now,
    });

    await db.collection('deliveries').insertOne({
      orderId: result.insertedId,
      status: 'pending',
      addressId: parsed.data.shippingAddressId
        ? new ObjectId(parsed.data.shippingAddressId)
        : undefined,
      trackingNumber: null,
      estimatedArrival: null,
      createdAt: now,
      updatedAt: now,
    });

    return ok(reply, { id: result.insertedId.toHexString(), total, status: 'pending' }, 'Order created', 201);
  });
}
