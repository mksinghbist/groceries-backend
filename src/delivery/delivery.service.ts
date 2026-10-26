import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryStatus, OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DeliveryService {
  constructor(private readonly prisma: PrismaService) {}

  async assign(vendorUserId: string, orderId: string, agentId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, store: { vendor: { userId: vendorUserId } } },
    });
    if (!order) throw new NotFoundException('Order not found for this vendor.');
    if (order.status !== OrderStatus.READY_FOR_DELIVERY) {
      throw new BadRequestException('Order must be READY_FOR_DELIVERY before assigning delivery.');
    }
    const agent = await this.prisma.user.findFirst({ where: { id: agentId, role: 'DELIVERY' } });
    if (!agent) throw new NotFoundException('Delivery agent not found.');
    if (await this.prisma.delivery.findUnique({ where: { orderId } })) {
      throw new ConflictException('A delivery has already been assigned to this order.');
    }
    return this.prisma.delivery.create({
      data: { orderId, agentId },
      include: { order: true, agent: { select: { id: true, name: true, email: true } } },
    });
  }

  async updateStatus(agentId: string, orderId: string, next: DeliveryStatus, trackingNote?: string) {
    const delivery = await this.prisma.delivery.findUnique({ where: { orderId }, include: { order: true } });
    if (!delivery) throw new NotFoundException('Delivery not found.');
    if (delivery.agentId !== agentId) throw new ForbiddenException('This delivery is assigned to another agent.');
    const allowed =
      (delivery.status === DeliveryStatus.ASSIGNED && next === DeliveryStatus.PICKED_UP) ||
      (delivery.status === DeliveryStatus.PICKED_UP && next === DeliveryStatus.IN_TRANSIT) ||
      (delivery.status === DeliveryStatus.IN_TRANSIT && next === DeliveryStatus.DELIVERED);
    if (!allowed) throw new BadRequestException(`Cannot transition delivery from ${delivery.status} to ${next}.`);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.delivery.update({
        where: { id: delivery.id },
        data: { status: next, trackingNote },
      });
      if (next === DeliveryStatus.PICKED_UP) {
        await tx.order.update({ where: { id: delivery.orderId }, data: { status: OrderStatus.OUT_FOR_DELIVERY } });
      } else if (next === DeliveryStatus.DELIVERED) {
        await tx.order.update({ where: { id: delivery.orderId }, data: { status: OrderStatus.DELIVERED } });
      }
      return updated;
    });
  }
}
