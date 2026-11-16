import type { FastifyInstance } from 'fastify';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { requireAuth } from '@/middleware/auth';
import { db } from '@/database/client';
import { ok, fail } from '@/utils/response';

const rentShopSchema = z.object({
  shopId: z.string(),
});

export default async function rentalsRoutes(app: FastifyInstance): Promise<void> {
  // Rent a shop
  app.post('/rentals', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = rentShopSchema.safeParse(request.body);
    if (!parsed.success) {
      return fail(reply, 'Invalid rental payload', 400);
    }

    const { shopId } = parsed.data;

    if (!ObjectId.isValid(shopId)) {
      return fail(reply, 'Invalid shop id', 400);
    }

    // Check if shop is available
    const shop = await db.collection('shops').findOne({ _id: new ObjectId(shopId) });
    if (!shop) {
      return fail(reply, 'Shop not found', 404);
    }

    if (shop.ownerId) {
      return fail(reply, 'Shop is already rented', 400);
    }

    // Check if user has shopkeeper profile
    let shopkeeper = await db.collection('shopkeepers').findOne({
      userId: new ObjectId(request.userId),
    });

    if (!shopkeeper) {
      // Create shopkeeper profile
      const now = new Date();
      const result = await db.collection('shopkeepers').insertOne({
        userId: new ObjectId(request.userId),
        shopIds: [],
        balance: 0,
        earnings: 0,
        reputation: 0,
        shopTier: 'BRONZE',
        membershipStatus: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      });
      shopkeeper = { _id: result.insertedId, userId: new ObjectId(request.userId) };
    }

    // Create rental with 1-year duration
    const startDate = new Date();
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);

    const result = await db.collection('shopRentals').insertOne({
      userId: new ObjectId(request.userId),
      shopId: new ObjectId(shopId),
      startDate,
      endDate,
      rentalFee: 1000, // Default fee - should be configurable per shop
      renewalFee: 900,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Update shop status
    await db.collection('shops').updateOne(
      { _id: new ObjectId(shopId) },
      {
        $set: {
          ownerId: new ObjectId(request.userId),
          status: 'ACTIVE',
          renewalDate: endDate,
          updatedAt: new Date(),
        },
      }
    );

    // Add shop to shopkeeper's shop list
    await db.collection('shopkeepers').updateOne(
      { userId: new ObjectId(request.userId) },
      { $push: { shopIds: new ObjectId(shopId) } as any }
    );

    return ok(reply, { id: result.insertedId.toHexString() }, 'Shop rented', 201);
  });

  // Get user's rentals
  app.get('/rentals', { preHandler: requireAuth }, async (request, reply) => {
    const rentals = await db.collection('shopRentals')
      .find({ userId: new ObjectId(request.userId) })
      .sort({ createdAt: -1 })
      .toArray();

    return ok(reply, { items: rentals }, 'Rentals');
  });

  // Renew rental
  app.post('/rentals/:id/renew', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!ObjectId.isValid(id)) {
      return fail(reply, 'Invalid rental id', 400);
    }

    const rental = await db.collection('shopRentals').findOne({
      _id: new ObjectId(id),
      userId: new ObjectId(request.userId),
    });

    if (!rental) {
      return fail(reply, 'Rental not found', 404);
    }

    // Extend rental by 1 year
    const newEndDate = new Date(rental.endDate);
    newEndDate.setFullYear(newEndDate.getFullYear() + 1);

    await db.collection('shopRentals').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          endDate: newEndDate,
          status: 'ACTIVE',
          updatedAt: new Date(),
        },
      }
    );

    // Update shop renewal date
    await db.collection('shops').updateOne(
      { _id: rental.shopId },
      { $set: { renewalDate: newEndDate, updatedAt: new Date() } }
    );

    return ok(reply, { id }, 'Rental renewed');
  });

  // Cancel rental
  app.delete('/rentals/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!ObjectId.isValid(id)) {
      return fail(reply, 'Invalid rental id', 400);
    }

    const rental = await db.collection('shopRentals').findOne({
      _id: new ObjectId(id),
      userId: new ObjectId(request.userId),
    });

    if (!rental) {
      return fail(reply, 'Rental not found', 404);
    }

    // Update rental status
    await db.collection('shopRentals').updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: 'CANCELLED', updatedAt: new Date() } }
    );

    // Make shop available again
    await db.collection('shops').updateOne(
      { _id: rental.shopId },
      {
        $set: {
          ownerId: null,
          status: 'ACTIVE',
          updatedAt: new Date(),
        },
      }
    );

    // Remove shop from shopkeeper's list
    await db.collection('shopkeepers').updateOne(
      { userId: new ObjectId(request.userId) },
      { $pull: { shopIds: rental.shopId } as any }
    );

    return ok(reply, { id }, 'Rental cancelled');
  });
}
