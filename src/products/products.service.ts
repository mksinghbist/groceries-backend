import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { VendorStatus } from '@prisma/client';
import { mkdir, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { CreateProductDto, UpdateProductDto } from '../common/dto';
import { PrismaService } from '../prisma/prisma.service';

const imageFormats = [
  { mimeType: 'image/jpeg', extension: 'jpg', matches: (buffer: Buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff },
  { mimeType: 'image/png', extension: 'png', matches: (buffer: Buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mimeType: 'image/gif', extension: 'gif', matches: (buffer: Buffer) => buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6)) },
  { mimeType: 'image/webp', extension: 'webp', matches: (buffer: Buffer) => buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP' },
];

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async uploadImage(userId: string, file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('An image file is required.');
    const format = imageFormats.find((candidate) => candidate.matches(file.buffer));
    if (!format || file.mimetype !== format.mimeType) {
      throw new BadRequestException('The uploaded file is not a supported JPEG, PNG, GIF, or WebP image.');
    }

    const vendor = await this.prisma.vendor.findUnique({
      where: { userId },
      select: { status: true },
    });
    if (!vendor || vendor.status !== VendorStatus.APPROVED) {
      throw new ForbiddenException('An approved vendor account is required to upload product images.');
    }

    const filename = `${randomUUID()}.${format.extension}`;
    const directory = join(process.cwd(), 'uploads', 'products');
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, filename), file.buffer, { flag: 'wx' });
    return { imageUrl: `/uploads/products/${filename}` };
  }

  async list(filters: { categoryId?: string; storeId?: string }) {
    let categoryIds: string[] | undefined;
    if (filters.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: filters.categoryId },
        select: { id: true, parentId: true, children: { where: { isActive: true }, select: { id: true } } },
      });
      categoryIds = category && !category.parentId
        ? [category.id, ...category.children.map((child) => child.id)]
        : [filters.categoryId];
    }
    return this.prisma.product.findMany({
      where: {
        isActive: true,
        ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
        ...(filters.storeId ? { storeId: filters.storeId } : {}),
        store: { isActive: true, vendor: { status: VendorStatus.APPROVED } },
      },
      include: { category: true, inventory: true, store: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async create(userId: string, input: CreateProductDto) {
    const store = await this.prisma.store.findFirst({
      where: { id: input.storeId, vendor: { userId, status: VendorStatus.APPROVED } },
    });
    if (!store) throw new ForbiddenException('An approved vendor-owned store is required.');
    return this.prisma.product.create({
      data: {
        storeId: input.storeId,
        categoryId: input.categoryId,
        name: input.name,
        description: input.description,
        price: input.price,
        imageUrl: input.imageUrl,
        inventory: { create: { storeId: input.storeId, quantity: input.quantity } },
      },
      include: { category: true, inventory: true },
    });
  }

  async update(userId: string, id: string, input: UpdateProductDto) {
    const product = await this.prisma.product.findFirst({
      where: { id, store: { vendor: { userId, status: VendorStatus.APPROVED } } },
    });
    if (!product) throw new NotFoundException('Product not found for this vendor.');
    return this.prisma.product.update({
      where: { id },
      data: input,
      include: { category: true, inventory: true },
    });
  }
}
