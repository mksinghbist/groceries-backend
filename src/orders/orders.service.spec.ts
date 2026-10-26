import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from './orders.service';

describe('OrdersService listForUser', () => {
  let service: OrdersService;
  const prisma = {
    order: { findMany: jest.fn<(...args: unknown[]) => Promise<never[]>>() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.order.findMany.mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrdersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(OrdersService);
  });

  it('returns only the requesting customer’s orders', async () => {
    await service.listForUser('customer-1', UserRole.CUSTOMER);

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'customer-1' } }),
    );
  });

  it('returns only orders belonging to the requesting vendor’s stores', async () => {
    await service.listForUser('vendor-1', UserRole.VENDOR);

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { store: { vendor: { userId: 'vendor-1' } } } }),
    );
  });

  it('returns all orders for an admin', async () => {
    await service.listForUser('admin-1', UserRole.ADMIN);

    expect(prisma.order.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it('does not expose order listing to other roles', async () => {
    expect(() => service.listForUser('agent-1', UserRole.DELIVERY)).toThrow(ForbiddenException);
    expect(prisma.order.findMany).not.toHaveBeenCalled();
  });
});
