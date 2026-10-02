import type { FastifyInstance } from 'fastify';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { requireAuth } from '@/middleware/auth';
import { db } from '@/database/client';
import { ok, fail } from '@/utils/response';

const messageSchema = z.object({
  channel: z.string().min(1).max(64),
  body: z.string().min(1).max(4000),
  kind: z.string().max(32).default('text'),
});

export default async function chatRoutes(app: FastifyInstance): Promise<void> {
  app.get('/chat/history', { preHandler: requireAuth }, async (request, reply) => {
    const q = request.query as { channel?: string };
    const channel = q.channel ?? 'world';

    const docs = await db.collection('chat_messages')
      .find({ channel })
      .sort({ sentAt: -1 })
      .limit(50)
      .toArray();

    const items = docs
      .reverse()
      .map((doc) => ({ id: doc._id.toHexString(), ...doc }));
    return ok(reply, items, 'Chat history');
  });

  app.post('/chat/messages', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = messageSchema.safeParse(request.body);
    if (!parsed.success) {
      return fail(reply, 'Invalid message payload', 400);
    }

    const result = await db.collection('chat_messages').insertOne({
      channel: parsed.data.channel,
      authorId: new ObjectId(request.userId),
      kind: parsed.data.kind,
      body: parsed.data.body,
      sentAt: new Date(),
    });

    return ok(reply, { id: result.insertedId.toHexString() }, 'Message sent', 201);
  });

  app.get('/chat/ws', { websocket: true }, (socket) => {
    socket.on('message', (raw: unknown) => {
      const message = typeof raw === 'string' ? raw : Buffer.isBuffer(raw) ? raw.toString() : String(raw);
      socket.send(`echo: ${message}`);
    });
  });
}
