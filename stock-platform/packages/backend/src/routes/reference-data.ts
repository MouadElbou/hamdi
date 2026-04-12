import type { FastifyPluginAsync } from 'fastify';

export const referenceDataRoutes: FastifyPluginAsync = async (app) => {
  const prisma = app.prisma;

  // GET /api/reference/suppliers
  app.get('/suppliers', async () => {
    return prisma.supplier.findMany({ where: { deletedAt: null }, orderBy: { code: 'asc' }, take: 1000 });
  });

  // GET /api/reference/boutiques
  app.get('/boutiques', async () => {
    return prisma.boutique.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' }, take: 1000 });
  });

  // GET /api/reference/categories
  app.get('/categories', async () => {
    return prisma.category.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' }, take: 1000 });
  });
};
