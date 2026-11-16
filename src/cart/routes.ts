import type { FastifyInstance } from 'fastify';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { requireAuth } from '@/middleware/auth';
import { db } from '@/database/client';
import { ok, fail } from '@/utils/response';

const cartItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().min(1),
});

export default async function cartRoutes(app: FastifyInstance): Promise<void> {
  // Get user's cart
  app.get('/cart/me', { preHandler: requireAuth }, async (request, reply) => {
    const cart = await db.collection('carts').findOne({
      userId: new ObjectId(request.userId),
    });

    if (!cart) {
      return ok(reply, { userId: request.userId, items: [], total: 0 }, 'Empty cart');
    }

    return ok(reply, { id: cart._id.toHexString(), ...cart }, 'Cart');
  });

  // Add item to cart
  app.post('/cart/me', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = cartItemSchema.safeParse(request.body);
    if (!parsed.success) {
      return fail(reply, 'Invalid cart item payload', 400);
    }

    const { productId, quantity } = parsed.data;

    if (!ObjectId.isValid(productId)) {
      return fail(reply, 'Invalid product id', 400);
    }

    // Check if product exists and has enough stock
    const product = await db.collection('products').findOne({
      _id: new ObjectId(productId),
      isActive: true,
    });

    if (!product) {
      return fail(reply, 'Product not found', 404);
    }

    // Check if item already exists in cart
    const existingCart = await db.collection('carts').findOne({
      userId: new ObjectId(request.userId),
    });

    if (existingCart) {
      const existingItem = existingCart.items?.find(
        (item: any) => item.productId.toString() === productId
      );

      if (existingItem) {
        // Update quantity
        const newQuantity = existingItem.quantity + quantity;
        await db.collection('carts').updateOne(
          { _id: existingCart._id },
          {
            $set: {
              'items.$[item].quantity': newQuantity,
              updatedAt: new Date(),
            },
          },
          { arrayFilters: [{ 'item.productId': new ObjectId(productId) }] } as any
        );
      } else {
        // Add new item
        await db.collection('carts').updateOne(
          { _id: existingCart._id },
          {
            $push: {
              items: {
                productId: new ObjectId(productId),
                quantity,
                price: product.price,
                name: product.name,
              },
            } as any,
            $set: { updatedAt: new Date() },
          }
        );
      }
    } else {
      // Create new cart
      await db.collection('carts').insertOne({
        userId: new ObjectId(request.userId),
        items: [
          {
            productId: new ObjectId(productId),
            quantity,
            price: product.price,
            name: product.name,
          },
        ] as any,
        total: product.price * quantity,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Recalculate total
    const updatedCart = await db.collection('carts').findOne({
      userId: new ObjectId(request.userId),
    });

    if (updatedCart) {
      const total = updatedCart.items?.reduce(
        (sum: number, item: any) => sum + item.price * item.quantity,
        0
      ) || 0;

      await db.collection('carts').updateOne(
        { _id: updatedCart._id },
        { $set: { total, updatedAt: new Date() } }
      );
    }

    return ok(reply, { success: true }, 'Item added to cart', 201);
  });

  // Remove item from cart
  app.delete('/cart/me/:productId', { preHandler: requireAuth }, async (request, reply) => {
    const { productId } = request.params as { productId: string };

    if (!ObjectId.isValid(productId)) {
      return fail(reply, 'Invalid product id', 400);
    }

    const cart = await db.collection('carts').findOne({
      userId: new ObjectId(request.userId),
    });

    if (!cart) {
      return fail(reply, 'Cart not found', 404);
    }

    await db.collection('carts').updateOne(
      { _id: cart._id },
      {
        $pull: { items: { productId: new ObjectId(productId) } } as any,
        $set: { updatedAt: new Date() },
      }
    );

    // Recalculate total
    const updatedCart = await db.collection('carts').findOne({ _id: cart._id });
    if (updatedCart) {
      const total = updatedCart.items?.reduce(
        (sum: number, item: any) => sum + item.price * item.quantity,
        0
      ) || 0;

      await db.collection('carts').updateOne(
        { _id: cart._id },
        { $set: { total, updatedAt: new Date() } }
      );
    }

    return ok(reply, { success: true }, 'Item removed from cart');
  });

  // Update cart item quantity
  app.put('/cart/me/:productId', { preHandler: requireAuth }, async (request, reply) => {
    const { productId } = request.params as { productId: string };
    const { quantity } = request.body as { quantity: number };

    if (!ObjectId.isValid(productId)) {
      return fail(reply, 'Invalid product id', 400);
    }

    if (quantity < 1) {
      return fail(reply, 'Quantity must be at least 1', 400);
    }

    const cart = await db.collection('carts').findOne({
      userId: new ObjectId(request.userId),
    });

    if (!cart) {
      return fail(reply, 'Cart not found', 404);
    }

    await db.collection('carts').updateOne(
      { _id: cart._id },
      {
        $set: {
          'items.$[item].quantity': quantity,
          updatedAt: new Date(),
        },
      },
      { arrayFilters: [{ 'item.productId': new ObjectId(productId) }] } as any
    );

    // Recalculate total
    const updatedCart = await db.collection('carts').findOne({ _id: cart._id });
    if (updatedCart) {
      const total = updatedCart.items?.reduce(
        (sum: number, item: any) => sum + item.price * item.quantity,
        0
      ) || 0;

      await db.collection('carts').updateOne(
        { _id: cart._id },
        { $set: { total, updatedAt: new Date() } }
      );
    }

    return ok(reply, { success: true }, 'Cart item updated');
  });

  // Clear cart
  app.delete('/cart/me', { preHandler: requireAuth }, async (request, reply) => {
    await db.collection('carts').deleteOne({
      userId: new ObjectId(request.userId),
    });

    return ok(reply, { success: true }, 'Cart cleared');
  });
}
