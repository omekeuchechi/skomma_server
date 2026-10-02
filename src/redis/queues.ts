import { Queue } from 'bullmq';
import { redis } from '@/redis/client';

export const deliveryQueue = new Queue('delivery', { connection: redis });

export const notificationQueue = new Queue('notifications', { connection: redis });

export const analyticsQueue = new Queue('analytics', { connection: redis });

export type QueueName = 'delivery' | 'notifications' | 'analytics';

export const queues: Record<QueueName, Queue> = {
  delivery: deliveryQueue,
  notifications: notificationQueue,
  analytics: analyticsQueue,
};
