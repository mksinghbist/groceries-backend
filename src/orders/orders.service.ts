import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, UserRole, VendorStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  listForUser(userId: string, role: UserRole) {
    let where;
    switch (role) {
      case UserRole.ADMIN:
        where = {};
        break;
      case UserRole.VENDOR:
        where = { store: { vendor: { userId } } };
        break;
      case UserRole.CUSTOMER:
        where = { userId };
        break;
      default:
        throw new ForbiddenException('You do not have permission to view orders.');
    }
    return this.prisma.order.findMany({
      where,
      include: { items: true, payment: true, delivery: true, store: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, addressId: string) {
    return this.prisma.$transaction(async (tx) => {
      const address = await tx.address.findFirst({ where: { id: addressId, userId } });
      if (!address) throw new NotFoundException('Delivery address not found.');

      const cart = await tx.cart.findUnique({
        where: { userId },
        include: {
          items: {
            include: {
              product: {
                include: { inventory: true, store: { include: { vendor: true } } },
              },
            },
          },
        },
      });
      if (!cart?.items.length) throw new BadRequestException('Your cart is empty.');
      const storeId = cart.items[0].product.storeId;
      if (
        cart.items.some(
          (item) =>
            item.product.storeId !== storeId ||
            !item.product.isActive ||
            item.product.store.vendor.status !== VendorStatus.APPROVED ||
            item.product.inventory === null ||
            item.product.inventory.quantity < item.quantity,
        )
      ) {
        throw new BadRequestException('Cart contains unavailable items or items from multiple stores.');
      }

      let total = 0;
      for (const item of cart.items) {
        const result = await tx.inventory.updateMany({
          where: { productId: item.productId, quantity: { gte: item.quantity } },
          data: { quantity: { decrement: item.quantity } },
        });
        if (result.count !== 1) throw new BadRequestException('Inventory changed; please review your cart.');
        total += Number(item.product.price) * item.quantity;
      }

      const order = await tx.order.create({
        data: {
          userId,
          storeId,
          addressId,
          total: Number(total.toFixed(2)),
          items: {
            create: cart.items.map((item) => ({
              productId: item.productId,
              name: item.product.name,
              unitPrice: item.product.price,
              quantity: item.quantity,
            })),
          },
        },
        include: { items: true, address: true, store: { select: { id: true, name: true } } },
      });
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      return order;
    });
  }

  async updateStatus(userId: string, orderId: string, nextStatus: OrderStatus) {
    if (nextStatus !== OrderStatus.PROCESSING && nextStatus !== OrderStatus.READY_FOR_DELIVERY) {
      throw new BadRequestException('Vendor status must be PROCESSING or READY_FOR_DELIVERY.');
    }
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, store: { vendor: { userId, status: VendorStatus.APPROVED } } },
      include: { payment: true },
    });
    if (!order) throw new NotFoundException('Order not found for this vendor.');
    const allowed =
      ((order.status === OrderStatus.PAID || order.status === OrderStatus.CONFIRMED) &&
        nextStatus === OrderStatus.PROCESSING) ||
      (order.status === OrderStatus.PROCESSING && nextStatus === OrderStatus.READY_FOR_DELIVERY);
    if (!allowed) throw new BadRequestException(`Cannot transition order from ${order.status} to ${nextStatus}.`);
    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: nextStatus },
      include: { items: true, delivery: true },
    });
  }
}
