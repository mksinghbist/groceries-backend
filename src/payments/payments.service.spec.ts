import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { createHmac } from 'crypto';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from './payments.service';

jest.mock('@nestjs/config', () => ({ ConfigService: class ConfigService {} }));

describe('PaymentsService cash on delivery', () => {
  let service: PaymentsService;
  const transaction = {
    payment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    order: { update: jest.fn() },
    paymentWebhookEvent: { createMany: jest.fn() },
    inventory: { updateMany: jest.fn() },
  };
  const prisma = {
    order: { findFirst: jest.fn() },
    payment: {
      create: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn((callback: (tx: typeof transaction) => unknown) => callback(transaction)),
  };
  const webhookSecret = 'test-webhook-secret';

  beforeEach(async () => {
    jest.clearAllMocks();
    service = new PaymentsService(
      prisma as unknown as PrismaService,
      { get: jest.fn(() => webhookSecret) } as unknown as ConfigService,
    );
  });

  it('confirms COD checkout while leaving payment pending collection', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      userId: 'customer-1',
      status: 'PENDING_PAYMENT',
      total: 25,
      payment: null,
    });
    transaction.payment.create.mockResolvedValue({
      providerRef: 'payment-ref',
      method: PaymentMethod.CASH_ON_DELIVERY,
      status: PaymentStatus.PENDING,
    });

    await expect(
      service.checkout('customer-1', 'order-1', PaymentMethod.CASH_ON_DELIVERY),
    ).resolves.toMatchObject({
      orderId: 'order-1',
      paymentReference: 'payment-ref',
      paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
      status: PaymentStatus.PENDING,
    });
    expect(transaction.payment.create).toHaveBeenCalledWith({
      data: { orderId: 'order-1', providerRef: expect.any(String), method: PaymentMethod.CASH_ON_DELIVERY },
    });
    expect(transaction.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { status: 'CONFIRMED' },
    });
  });

  it('returns the existing COD checkout result on retry', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'CONFIRMED',
      total: 25,
      payment: { providerRef: 'payment-ref', method: PaymentMethod.CASH_ON_DELIVERY, status: PaymentStatus.PENDING },
    });

    await expect(
      service.checkout('customer-1', 'order-1', PaymentMethod.CASH_ON_DELIVERY),
    ).resolves.toMatchObject({ paymentReference: 'payment-ref', status: PaymentStatus.PENDING });
    expect(transaction.payment.create).not.toHaveBeenCalled();
    expect(transaction.order.update).not.toHaveBeenCalled();
  });

  it('does not allow changing the selected payment method', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'PENDING_PAYMENT',
      total: 25,
      payment: { providerRef: 'online-ref', method: PaymentMethod.ONLINE, status: PaymentStatus.PENDING },
    });

    await expect(
      service.checkout('customer-1', 'order-1', PaymentMethod.CASH_ON_DELIVERY),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('allows the assigned delivery agent to record collected cash after delivery', async () => {
    prisma.payment.findFirst.mockResolvedValue({ id: 'payment-1', status: PaymentStatus.PENDING });
    prisma.payment.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.collectCashOnDelivery('agent-1', 'order-1')).resolves.toEqual({
      orderId: 'order-1',
      paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
      status: PaymentStatus.SUCCEEDED,
    });
    expect(prisma.payment.findFirst).toHaveBeenCalledWith({
      where: {
        orderId: 'order-1',
        method: PaymentMethod.CASH_ON_DELIVERY,
        order: { delivery: { agentId: 'agent-1', status: 'DELIVERED' } },
      },
    });
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'payment-1', status: PaymentStatus.PENDING },
      data: { status: PaymentStatus.SUCCEEDED },
    });
  });

  it('does not allow collecting cash for another agent or an undelivered order', async () => {
    prisma.payment.findFirst.mockResolvedValue(null);

    await expect(service.collectCashOnDelivery('agent-1', 'order-1')).rejects.toThrow(NotFoundException);
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
  });

  it('rejects online webhooks for COD payments', async () => {
    const payload = JSON.stringify({ eventId: 'event-1', providerRef: 'cod-ref', status: 'succeeded' });
    const rawBody = Buffer.from(payload);
    const signature = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    transaction.payment.findUnique.mockResolvedValue({
      id: 'payment-1',
      method: PaymentMethod.CASH_ON_DELIVERY,
    });

    await expect(service.handleWebhook(rawBody, signature)).rejects.toThrow(BadRequestException);
    expect(transaction.paymentWebhookEvent.createMany).not.toHaveBeenCalled();
  });
});
