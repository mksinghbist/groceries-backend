import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.inventory.findMany({
      where: { store: { vendor: { userId } } },
      include: { product: { select: { id: true, name: true, price: true } }, store: { select: { id: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async update(userId: string, id: string, quantity: number) {
    const inventory = await this.prisma.inventory.findFirst({
      where: { id, store: { vendor: { userId } } },
      select: { id: true },
    });
    if (!inventory) throw new NotFoundException('Inventory record not found for this vendor.');
    return this.prisma.inventory.update({ where: { id }, data: { quantity } });
  }
}
