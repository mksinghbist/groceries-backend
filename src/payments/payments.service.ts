import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeliveryStatus, OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

interface PaymentWebhook {
  eventId: string;
  providerRef: string;
  status: 'succeeded' | 'failed';
}

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async checkout(userId: string, orderId: string, method: PaymentMethod = PaymentMethod.ONLINE) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId }, include: { payment: true } });
    if (!order) throw new NotFoundException('Order not found.');
    const existingCashOrder =
      method === PaymentMethod.CASH_ON_DELIVERY &&
      order.status === OrderStatus.CONFIRMED &&
      order.payment?.method === PaymentMethod.CASH_ON_DELIVERY;
    if (order.status !== OrderStatus.PENDING_PAYMENT && !existingCashOrder) {
      throw new BadRequestException('Order is not awaiting payment.');
    }
    if (order.payment && order.payment.method !== method) {
      throw new BadRequestException('A different payment method has already been selected for this order.');
    }
    const payment = await this.prisma.$transaction(async (tx) => {
      const selectedPayment = order.payment ?? await tx.payment.create({
        data: { orderId, providerRef: randomUUID(), method },
      });
      if (method === PaymentMethod.CASH_ON_DELIVERY && order.status === OrderStatus.PENDING_PAYMENT) {
        await tx.order.update({ where: { id: orderId }, data: { status: OrderStatus.CONFIRMED } });
      }
      return selectedPayment;
    });
    return {
      orderId,
      paymentReference: payment.providerRef,
      amount: order.total,
      currency: 'USD',
      paymentMethod: payment.method,
      status: payment.status,
      ...(payment.method === PaymentMethod.CASH_ON_DELIVERY
        ? { paymentDue: 'Pay cash to the delivery agent upon delivery.' }
        : {}),
    };
  }

  async collectCashOnDelivery(deliveryAgentId: string, orderId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        orderId,
        method: PaymentMethod.CASH_ON_DELIVERY,
        order: { delivery: { agentId: deliveryAgentId, status: DeliveryStatus.DELIVERED } },
      },
    });
    if (!payment) throw new NotFoundException('Delivered cash-on-delivery order not found for this agent.');
    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Cash on delivery has already been collected or is no longer pending.');
    }
    const updated = await this.prisma.payment.updateMany({
      where: { id: payment.id, status: PaymentStatus.PENDING },
      data: { status: PaymentStatus.SUCCEEDED },
    });
    if (updated.count !== 1) {
      throw new BadRequestException('Cash on delivery has already been collected or is no longer pending.');
    }
    return { orderId, paymentMethod: PaymentMethod.CASH_ON_DELIVERY, status: PaymentStatus.SUCCEEDED };
  }

  async handleWebhook(rawBody: Buffer | undefined, signature: string | undefined) {
    const secret = this.config.get<string>('PAYMENT_WEBHOOK_SECRET');
    if (!secret) {
      throw new Error('PAYMENT_WEBHOOK_SECRET is required. Copy .env.example to .env and set a secure secret.');
    }
    if (!rawBody || !signature) throw new UnauthorizedException('A signed raw webhook request is required.');

    const expected = createHmac('sha256', secret).update(rawBody).digest();
    let provided: Buffer;
    try {
      provided = Buffer.from(signature, 'hex');
    } catch {
      throw new UnauthorizedException('Invalid webhook signature.');
    }
    if (provided.length !== expected.length || !timingSafeEqual(expected, provided)) {
      throw new UnauthorizedException('Invalid webhook signature.');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody.toString('utf8')) as unknown;
    } catch {
      throw new BadRequestException('Webhook body must be valid JSON.');
    }
    if (typeof parsed !== 'object' || parsed === null) {
      throw new BadRequestException('Webhook body must be a JSON object.');
    }
    const event = parsed as Partial<PaymentWebhook>;
    if (
      typeof event.eventId !== 'string' ||
      typeof event.providerRef !== 'string' ||
      typeof event.status !== 'string' ||
      !['succeeded', 'failed'].includes(event.status)
    ) {
      throw new BadRequestException('Webhook requires eventId, providerRef, and a succeeded or failed status.');
    }
    const eventId = event.eventId;
    const providerRef = event.providerRef;
    const eventStatus = event.status;

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { providerRef },
        include: { order: { include: { items: true } } },
      });
      if (!payment) throw new NotFoundException('Payment reference not found.');
      if (payment.method !== PaymentMethod.ONLINE) {
        throw new BadRequestException('Online payment webhooks cannot update cash-on-delivery payments.');
      }
      const inserted = await tx.paymentWebhookEvent.createMany({
        data: [{ id: eventId }],
        skipDuplicates: true,
      });
      if (inserted.count === 0) return { received: true, duplicate: true };
      if (payment.status !== PaymentStatus.PENDING) return { received: true, duplicate: false };

      const succeeded = eventStatus === 'succeeded';
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: succeeded ? PaymentStatus.SUCCEEDED : PaymentStatus.FAILED },
      });
      if (succeeded) {
        await tx.order.update({ where: { id: payment.orderId }, data: { status: OrderStatus.PAID } });
      } else {
        for (const item of payment.order.items) {
          await tx.inventory.updateMany({
            where: { productId: item.productId },
            data: { quantity: { increment: item.quantity } },
          });
        }
        await tx.order.update({ where: { id: payment.orderId }, data: { status: OrderStatus.CANCELLED } });
      }
      return { received: true, duplicate: false };
    });
  }
}
