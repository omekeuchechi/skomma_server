import '@fastify/jwt';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    jwt: {
      sign(payload: any, options?: any): string;
      verify(token: string, options?: any): any;
    };
  }

  interface FastifyRequest {
    userId?: string;
  }
}
