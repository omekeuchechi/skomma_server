import type { FastifyInstance } from 'fastify';
import { db } from '@/database/client';
import { ok } from '@/utils/response';

interface WorldTile {
  _id?: { toHexString: () => string };
  x: number;
  y: number;
  type: string;
  spriteId: string;
}

interface WorldSprite {
  _id?: { toHexString: () => string };
  type: string;
  x: number;
  y: number;
  assetId: string;
  animation?: string;
}

export default async function worldRoutes(app: FastifyInstance): Promise<void> {
  app.get('/world/status', async (_request, reply) => {
    const npcCount = await db.collection('npcs').countDocuments();

    return ok(
      reply,
      {
        name: 'Skomma 2D World',
        version: '0.2.0',
        worldType: '2d',
        npcCount,
        status: 'online',
        tickRate: 60,
      },
      'World status',
    );
  });

  app.get('/world/tiles', async (_request, reply) => {
    // Return 2D tile data for world rendering
    const tiles = await db.collection<WorldTile>('world_tiles').find({}).limit(100).toArray();
    
    return ok(
      reply,
      {
        tiles: tiles.map((tile) => ({
          id: tile._id?.toHexString(),
          x: tile.x,
          y: tile.y,
          type: tile.type,
          spriteId: tile.spriteId,
        })),
      },
      'World tiles',
    );
  });

  app.get('/world/sprites', async (_request, reply) => {
    // Return sprite data for 2D entities
    const sprites = await db.collection<WorldSprite>('world_sprites').find({}).limit(50).toArray();
    
    return ok(
      reply,
      {
        sprites: sprites.map((sprite) => ({
          id: sprite._id?.toHexString(),
          type: sprite.type,
          x: sprite.x,
          y: sprite.y,
          assetId: sprite.assetId,
          animation: sprite.animation,
        })),
      },
      'World sprites',
    );
  });
}
