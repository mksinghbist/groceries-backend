import { Injectable, NotFoundException } from '@nestjs/common';
import { VendorStatus } from '@prisma/client';
import { AddCartItemDto } from '../common/dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string) {
    const cart = await this.prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
      include: { items: { include: { product: { include: { inventory: true } } } } },
    });
    const total = cart.items.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);
    return { ...cart, total: Number(total.toFixed(2)) };
  }

  async addItem(userId: string, input: AddCartItemDto) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: input.productId,
        isActive: true,
        store: { isActive: true, vendor: { status: VendorStatus.APPROVED } },
      },
      include: { inventory: true },
    });
    if (!product || !product.inventory) throw new NotFoundException('Available product not found.');
    if (product.inventory.quantity < input.quantity) {
      throw new NotFoundException('Requested quantity is not available.');
    }

    const cart = await this.prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    await this.prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId: product.id } },
      create: { cartId: cart.id, productId: product.id, quantity: input.quantity },
      update: { quantity: { increment: input.quantity } },
    });
    return this.get(userId);
  }
}
