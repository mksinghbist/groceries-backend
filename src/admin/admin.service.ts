import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole, VendorStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CreateAdminDto, CreateDeliveryAgentDto } from '../common/dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const [users, vendors, pendingVendors, products, orders, paidOrders] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.vendor.count(),
      this.prisma.vendor.count({ where: { status: VendorStatus.PENDING } }),
      this.prisma.product.count(),
      this.prisma.order.count(),
      this.prisma.order.aggregate({ where: { status: 'PAID' }, _sum: { total: true } }),
    ]);
    return { users, vendors, pendingVendors, products, orders, paidRevenue: paidOrders._sum.total ?? 0 };
  }

  listVendors() {
    return this.prisma.vendor.findMany({
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
  }

  async approveVendor(vendorId: string) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new NotFoundException('Vendor not found.');
    return this.prisma.vendor.update({
      where: { id: vendorId },
      data: { status: VendorStatus.APPROVED },
      include: { user: { select: { id: true, email: true, name: true, role: true } } },
    });
  }

  async createDeliveryAgent(input: CreateDeliveryAgentDto) {
    return this.createUser(input, UserRole.DELIVERY);
  }

  async createAdmin(input: CreateAdminDto) {
    return this.createUser(input, UserRole.ADMIN);
  }

  private async createUser(input: CreateAdminDto | CreateDeliveryAgentDto, role: UserRole) {
    const email = input.email.toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException('An account with this email already exists.');
    }
    const passwordHash = await bcrypt.hash(input.password, 12);
    return this.prisma.user.create({
      data: { email, name: input.name, passwordHash, role },
      select: { id: true, email: true, name: true, role: true },
    });
  }
}
