import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const RefQuery = z.object({
  limit: z.coerce.number().int().min(1).max(5000).default(1000),
});

export const referenceDataRoutes: FastifyPluginAsync = async (app) => {
  const prisma = app.prisma;

  // GET /api/reference/suppliers
  app.get('/suppliers', async (request) => {
    const { limit } = RefQuery.parse(request.query);
    return prisma.supplier.findMany({ where: { deletedAt: null }, orderBy: { code: 'asc' }, take: limit });
  });

  // GET /api/reference/boutiques
  app.get('/boutiques', async (request) => {
    const { limit } = RefQuery.parse(request.query);
    return prisma.boutique.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' }, take: limit });
  });

  // GET /api/reference/categories
  app.get('/categories', async (request) => {
    const { limit } = RefQuery.parse(request.query);
    return prisma.category.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' }, take: limit });
  });
};
