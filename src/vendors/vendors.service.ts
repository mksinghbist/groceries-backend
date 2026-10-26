import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { VendorStatus } from '@prisma/client';
import { CreateStoreDto } from '../common/dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VendorsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { userId },
      include: { stores: true },
    });
    if (!vendor) throw new NotFoundException('Vendor profile not found.');
    return vendor;
  }

  async createStore(userId: string, input: CreateStoreDto) {
    const vendor = await this.prisma.vendor.findUnique({ where: { userId } });
    if (!vendor) throw new NotFoundException('Vendor profile not found.');
    if (vendor.status !== VendorStatus.APPROVED) {
      throw new ForbiddenException('Vendor approval is required before creating a store.');
    }
    return this.prisma.store.create({ data: { ...input, vendorId: vendor.id } });
  }
}
