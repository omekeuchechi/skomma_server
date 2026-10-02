import type { FastifyInstance } from 'fastify';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { requireAuth } from '@/middleware/auth';
import { db } from '@/database/client';
import { ok, fail } from '@/utils/response';

const paymentSchema = z.object({
  orderId: z.string(),
  method: z.enum(['wallet', 'card', 'crypto']),
  amount: z.number().positive(),
});

export default async function paymentsRoutes(app: FastifyInstance): Promise<void> {
  app.post('/payments', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = paymentSchema.safeParse(request.body);
    if (!parsed.success) {
      return fail(reply, 'Invalid payment payload', 400);
    }

    const order = await db.collection('orders').findOne({
      _id: new ObjectId(parsed.data.orderId),
      userId: new ObjectId(request.userId),
    });
    if (!order) {
      return fail(reply, 'Order not found', 404);
    }

    const result = await db.collection('payments').insertOne({
      orderId: new ObjectId(parsed.data.orderId),
      method: parsed.data.method,
      amount: parsed.data.amount,
      status: 'pending',
      provider: null,
      createdAt: new Date(),
    });

    return ok(reply, { id: result.insertedId.toHexString(), status: 'pending' }, 'Payment initiated', 201);
  });

  app.get('/payments/order/:orderId', { preHandler: requireAuth }, async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    if (!ObjectId.isValid(orderId)) {
      return fail(reply, 'Invalid order id', 400);
    }

    const docs = await db.collection('payments').find({ orderId: new ObjectId(orderId) }).toArray();
    return ok(reply, docs.map((doc) => ({ id: doc._id.toHexString(), ...doc })), 'Payments');
  });
}
