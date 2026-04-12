import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const CreateClientSchema = z.object({
    name: z.string().trim().min(1),
    phone: z.string().optional(),
});

export async function clientRoutes(app: FastifyInstance): Promise<void> {
    const prisma = app.prisma;

    // List all clients
    app.get('/', async (req) => {
        const { page, limit } = req.query as { page?: string; limit?: string };
        const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
        const take = Math.min(parseInt(limit ?? '50', 10) || 50, 200);
        const skip = (pageNum - 1) * take;

        const [items, total] = await Promise.all([
            prisma.client.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' }, skip, take }),
            prisma.client.count({ where: { deletedAt: null } }),
        ]);

        return { items, total, page: pageNum, limit: take };
    });

    // Create or return existing client (upsert by name)
    app.post('/', async (req, reply) => {
        const data = CreateClientSchema.parse(req.body);
        const trimmed = data.name.trim();

        try {
            const result = await prisma.$transaction(async (tx) => {
                const existing = await tx.client.findFirst({ where: { name: trimmed, deletedAt: null } });
                if (existing) return { client: existing, created: false };
                const client = await tx.client.create({ data: { name: trimmed, phone: data.phone ?? null } });
                return { client, created: true };
            }, { isolationLevel: 'Serializable' });
            if (result.created) reply.code(201);
            return result.client;
        } catch (e: any) {
            if (e?.code === 'P2002') {
                return prisma.client.findFirst({ where: { name: trimmed, deletedAt: null } });
            }
            throw e;
        }
    });
}
