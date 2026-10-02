import websocket from '@fastify/websocket';
import type { FastifyInstance } from 'fastify';

export default async function registerWebsocket(app: FastifyInstance): Promise<void> {
  await app.register(websocket);
}
