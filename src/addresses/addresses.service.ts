import { Injectable } from '@nestjs/common';
import { CreateAddressDto } from '../common/dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.address.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  create(userId: string, input: CreateAddressDto) {
    return this.prisma.address.create({ data: { ...input, userId } });
  }
}
