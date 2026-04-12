import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { v7 as uuidv7 } from 'uuid';

const CreateEmployeeSchema = z.object({
    name: z.string().trim().min(1),
    monthlySalary: z.number().int().positive(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const UpdateEmployeeSchema = z.object({
    name: z.string().trim().min(1),
    monthlySalary: z.number().int().positive(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    isActive: z.boolean(),
    version: z.number().int(),
});

const CreatePaymentSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    amount: z.number().int().positive(),
    note: z.string().optional(),
});

export async function employeeRoutes(app: FastifyInstance): Promise<void> {
    const prisma = app.prisma;

    // List employees
    app.get('/', async (req) => {
        const { page = '1', limit = '50' } = req.query as Record<string, string | undefined>;
        const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
        const limitNum = Math.min(Math.max(1, parseInt(limit ?? '50', 10) || 50), 200);
        const skip = (pageNum - 1) * limitNum;

        const [employees, total] = await Promise.all([
            prisma.employee.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' }, skip, take: limitNum }),
            prisma.employee.count({ where: { deletedAt: null } }),
        ]);
        return { items: employees, total, page: pageNum, limit: limitNum };
    });

    // Create employee
    app.post('/', async (req, reply) => {
        const data = CreateEmployeeSchema.parse(req.body);
        const employee = await prisma.employee.create({
            data: {
                id: uuidv7(),
                name: data.name.trim(),
                monthlySalary: data.monthlySalary,
                startDate: new Date(data.startDate),
            },
        });
        reply.code(201);
        return employee;
    });

    // Update employee
    app.patch('/:id', async (req, reply) => {
        const { id } = req.params as { id: string };
        const data = UpdateEmployeeSchema.parse(req.body);
        const existing = await prisma.employee.findFirst({ where: { id, deletedAt: null } });
        if (!existing) return reply.notFound('Employee not found');

        return prisma.$transaction(async (tx) => {
            const current = await tx.employee.findUnique({ where: { id } });
            if (!current || current.version !== data.version) {
                const err = new Error('Version mismatch — pull latest before updating');
                (err as any).statusCode = 409;
                throw err;
            }

            return tx.employee.update({
                where: { id },
                data: {
                    name: data.name.trim(),
                    monthlySalary: data.monthlySalary,
                    startDate: new Date(data.startDate),
                    isActive: data.isActive,
                    version: { increment: 1 },
                },
            });
        }, { isolationLevel: 'Serializable' });
    });

    // Soft delete employee
    app.delete('/:id', async (req, reply) => {
        const { id } = req.params as { id: string };
        const result = await prisma.$transaction(async (tx) => {
            const existing = await tx.employee.findFirst({ where: { id, deletedAt: null } });
            if (!existing) return null;
            await tx.employee.update({ where: { id }, data: { deletedAt: new Date(), version: { increment: 1 } } });
            return { deleted: true };
        }, { isolationLevel: 'Serializable' });
        if (!result) return reply.notFound('Employee not found');
        return result;
    });

    // List salary payments for an employee
    app.get('/:id/payments', async (req) => {
        const { id } = req.params as { id: string };
        const query = req.query as { page?: string; limit?: string };
        const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
        const limit = Math.min(Math.max(1, parseInt(query.limit ?? '50', 10) || 50), 200);
        const [items, total] = await Promise.all([
            prisma.salaryPayment.findMany({
                where: { employeeId: id, deletedAt: null },
                orderBy: { date: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.salaryPayment.count({ where: { employeeId: id, deletedAt: null } }),
        ]);
        return { items, total, page, limit };
    });

    // Record salary payment
    app.post('/:id/payments', async (req, reply) => {
        const { id } = req.params as { id: string };
        const data = CreatePaymentSchema.parse(req.body);

        const employee = await prisma.employee.findFirst({ where: { id, deletedAt: null } });
        if (!employee) return reply.notFound('Employee not found');

        // Wrap in Serializable transaction to prevent concurrent overpayment
        const payment = await prisma.$transaction(async (tx) => {
            // Overpayment guard: sum payments for the same month only
            const paymentDate = new Date(data.date);
            const monthStart = new Date(paymentDate.getFullYear(), paymentDate.getMonth(), 1);
            const monthEnd = new Date(paymentDate.getFullYear(), paymentDate.getMonth() + 1, 1);
            const agg = await tx.salaryPayment.aggregate({
                where: { employeeId: id, deletedAt: null, date: { gte: monthStart, lt: monthEnd } },
                _sum: { amount: true },
            });
            const alreadyPaid = agg._sum.amount ?? 0;
            if (alreadyPaid + data.amount > employee.monthlySalary) {
                const err = new Error(`Le paiement dépasse le salaire mensuel (déjà payé: ${alreadyPaid}, salaire: ${employee.monthlySalary})`);
                (err as any).statusCode = 400;
                throw err;
            }

            return tx.salaryPayment.create({
                data: {
                    id: uuidv7(),
                    date: paymentDate,
                    amount: data.amount,
                    note: data.note ?? null,
                    employeeId: id,
                },
            });
        }, { isolationLevel: 'Serializable' });

        reply.code(201);
        return payment;
    });
}
