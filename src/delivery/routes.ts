import type { FastifyInstance } from 'fastify';
import { ObjectId } from 'mongodb';
import { requireAuth } from '@/middleware/auth';
import { db } from '@/database/client';
import { ok, fail } from '@/utils/response';

export default async function deliveryRoutes(app: FastifyInstance): Promise<void> {
  app.get('/delivery/:orderId', { preHandler: requireAuth }, async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    if (!ObjectId.isValid(orderId)) {
      return fail(reply, 'Invalid order id', 400);
    }

    const order = await db.collection('orders').findOne({
      _id: new ObjectId(orderId),
      userId: new ObjectId(request.userId),
    });
    if (!order) {
      return fail(reply, 'Order not found', 404);
    }

    const delivery = await db.collection('deliveries').findOne({ orderId: new ObjectId(orderId) });
    if (!delivery) {
      return fail(reply, 'No delivery record for this order', 404);
    }

    return ok(reply, { id: delivery._id.toHexString(), ...delivery }, 'Delivery status');
  });
}
