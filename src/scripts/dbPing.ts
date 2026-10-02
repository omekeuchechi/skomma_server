import { connectDatabase, db, disconnectDatabase } from '@/database/client';

async function main(): Promise<void> {
  await connectDatabase();
  const ping = await db.command({ ping: 1 });
  console.log('MongoDB ping ok:', JSON.stringify(ping));
  await disconnectDatabase();
}

main().catch((error: unknown) => {
  console.error('MongoDB ping failed:', error);
  process.exit(1);
});
