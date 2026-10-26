import * as bcrypt from 'bcrypt';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  let service: AdminService;
  const prisma = {
    user: { count: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
    vendor: { count: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    product: { count: jest.fn() },
    order: { count: jest.fn(), aggregate: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.user.count.mockResolvedValue(12);
    prisma.vendor.count.mockResolvedValueOnce(5).mockResolvedValueOnce(2);
    prisma.product.count.mockResolvedValue(30);
    prisma.order.count.mockResolvedValue(20);
    prisma.order.aggregate.mockResolvedValue({ _sum: { total: 145.5 } });

    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(AdminService);
  });

  it('returns the dashboard totals', async () => {
    await expect(service.dashboard()).resolves.toEqual({
      users: 12,
      vendors: 5,
      pendingVendors: 2,
      products: 30,
      orders: 20,
      paidRevenue: 145.5,
    });
  });

  it('approves an existing vendor', async () => {
    prisma.vendor.findUnique.mockResolvedValue({ id: 'vendor-1' });
    prisma.vendor.update.mockResolvedValue({ id: 'vendor-1', status: 'APPROVED' });

    await expect(service.approveVendor('vendor-1')).resolves.toEqual({
      id: 'vendor-1',
      status: 'APPROVED',
    });
    expect(prisma.vendor.update).toHaveBeenCalledWith({
      where: { id: 'vendor-1' },
      data: { status: 'APPROVED' },
      include: { user: { select: { id: true, email: true, name: true, role: true } } },
    });
  });

  it('lists vendors with their account details and no sensitive fields', async () => {
    const vendors = [
      {
        id: 'vendor-1',
        status: 'PENDING',
        businessName: 'Fresh Foods',
        phone: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        user: { id: 'user-1', email: 'vendor@example.com', name: 'Vendor User' },
      },
    ];
    prisma.vendor.findMany.mockResolvedValue(vendors);

    await expect(service.listVendors()).resolves.toEqual(vendors);
    expect(prisma.vendor.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        businessName: true,
        phone: true,
        createdAt: true,
        user: { select: { id: true, email: true, name: true } },
      },
    });
  });

  it('creates delivery agents with a hashed password', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'agent-1',
      email: 'agent@example.com',
      name: 'Delivery Agent',
      role: 'DELIVERY',
    });

    await expect(
      service.createDeliveryAgent({
        email: 'Agent@Example.com',
        name: 'Delivery Agent',
        password: 'long-enough-password',
      }),
    ).resolves.toEqual({
      id: 'agent-1',
      email: 'agent@example.com',
      name: 'Delivery Agent',
      role: 'DELIVERY',
    });
    const createInput = prisma.user.create.mock.calls[0][0];
    expect(createInput.data.passwordHash).not.toBe('long-enough-password');
    await expect(bcrypt.compare('long-enough-password', createInput.data.passwordHash)).resolves.toBe(true);
  });

  it('creates admins with a hashed password', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Administrator',
      role: 'ADMIN',
    });

    await expect(
      service.createAdmin({
        email: 'Admin@Example.com',
        name: 'Administrator',
        password: 'long-enough-password',
      }),
    ).resolves.toEqual({
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Administrator',
      role: 'ADMIN',
    });
    const createInput = prisma.user.create.mock.calls[0][0];
    expect(createInput.data).toMatchObject({ email: 'admin@example.com', role: 'ADMIN' });
    expect(createInput.data.passwordHash).not.toBe('long-enough-password');
    await expect(bcrypt.compare('long-enough-password', createInput.data.passwordHash)).resolves.toBe(true);
  });
});
