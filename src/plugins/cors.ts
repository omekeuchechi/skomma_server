import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';

export default async function registerCors(app: FastifyInstance): Promise<void> {
  await app.register(cors, {
    origin: true, // Allow all origins for development
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
  });
}
