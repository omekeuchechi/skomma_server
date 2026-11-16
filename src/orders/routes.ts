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
  shopId: z.string(),
  lines: z.array(lineSchema).min(1),
  deliveryAddress: z.object({
    fullName: z.string().min(1),
    addressLine1: z.string().min(1),
    addressLine2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().min(1),
    postalCode: z.string().min(1),
    country: z.string().min(1),
    phone: z.string().min(1),
    deliveryNotes: z.string().optional(),
  }),
});

export default async function ordersRoutes(app: FastifyInstance): Promise<void> {
  // Get user's orders
  app.get('/orders', { preHandler: requireAuth }, async (request, reply) => {
    const q = request.query as { shopId?: string };
    const filter: Record<string, unknown> = { userId: new ObjectId(request.userId) };

    if (q.shopId && ObjectId.isValid(q.shopId)) {
      filter.shopId = new ObjectId(q.shopId);
    }

    const docs = await db.collection('orders')
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    const items = docs.map((doc) => ({ id: doc._id.toHexString(), ...doc }));
    return ok(reply, items, 'Orders');
  });

  // Get order by ID
  app.get('/orders/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!ObjectId.isValid(id)) {
      return fail(reply, 'Invalid order id', 400);
    }

    const order = await db.collection('orders').findOne({
      _id: new ObjectId(id),
      userId: new ObjectId(request.userId),
    });

    if (!order) {
      return fail(reply, 'Order not found', 404);
    }

    return ok(reply, { id: order._id.toHexString(), ...order }, 'Order');
  });

  // Create order from cart
  app.post('/orders', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = createOrderSchema.safeParse(request.body);
    if (!parsed.success) {
      return fail(reply, 'Invalid order payload', 400);
    }

    const { shopId, lines, deliveryAddress } = parsed.data;

    if (!ObjectId.isValid(shopId)) {
      return fail(reply, 'Invalid shop id', 400);
    }

    // Verify shop exists
    const shop = await db.collection('shops').findOne({ _id: new ObjectId(shopId) });
    if (!shop) {
      return fail(reply, 'Shop not found', 404);
    }

    // Get user's cart
    const cart = await db.collection('carts').findOne({
      userId: new ObjectId(request.userId),
    });

    if (!cart || !cart.items || cart.items.length === 0) {
      return fail(reply, 'Cart is empty', 400);
    }

    // Calculate total
    const total = lines.reduce(
      (sum, line) => sum + line.unitPrice * line.quantity,
      0,
    );

    const now = new Date();
    const result = await db.collection('orders').insertOne({
      userId: new ObjectId(request.userId),
      shopId: new ObjectId(shopId),
      lines: lines.map((line) => ({
        productId: new ObjectId(line.productId),
        title: line.title,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      })),
      total,
      status: 'PENDING',
      deliveryAddress,
      createdAt: now,
      updatedAt: now,
    });

    // Clear cart
    await db.collection('carts').deleteOne({
      userId: new ObjectId(request.userId),
    });

    // Create delivery record
    await db.collection('deliveries').insertOne({
      orderId: result.insertedId,
      status: 'PENDING',
      address: deliveryAddress,
      trackingNumber: null,
      estimatedArrival: null,
      createdAt: now,
      updatedAt: now,
    });

    return ok(
      reply,
      { id: result.insertedId.toHexString(), total, status: 'PENDING' },
      'Order created',
      201
    );
  });

  // Update order status (admin/shopkeeper only)
  app.put('/orders/:id/status', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: string };

    if (!ObjectId.isValid(id)) {
      return fail(reply, 'Invalid order id', 400);
    }

    const validStatuses = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return fail(reply, 'Invalid status', 400);
    }

    const order = await db.collection('orders').findOne({ _id: new ObjectId(id) });
    if (!order) {
      return fail(reply, 'Order not found', 404);
    }

    // Verify ownership or admin status
    // TODO: Add admin check here

    await db.collection('orders').updateOne(
      { _id: new ObjectId(id) },
      { $set: { status, updatedAt: new Date() } }
    );

    return ok(reply, { id, status }, 'Order status updated');
  });
}
