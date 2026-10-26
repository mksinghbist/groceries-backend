import { Test, TestingModule } from '@nestjs/testing';
import { VendorStatus } from '@prisma/client';
import { readFile, rm } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  let service: ProductsService;
  const prisma = {
    category: { findUnique: jest.fn() },
    product: { findMany: jest.fn() },
    vendor: { findUnique: jest.fn() },
  };
  const uploadedFiles: string[] = [];

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.product.findMany.mockResolvedValue([]);
    uploadedFiles.length = 0;
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(ProductsService);
  });

  it('includes subcategory products when filtering by a top-level category', async () => {
    prisma.category.findUnique.mockResolvedValue({
      id: 'produce',
      parentId: null,
      children: [{ id: 'fruit' }, { id: 'vegetables' }],
    });

    await service.list({ categoryId: 'produce' });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ categoryId: { in: ['produce', 'fruit', 'vegetables'] } }),
      }),
    );
  });

  it('filters directly by the selected subcategory', async () => {
    prisma.category.findUnique.mockResolvedValue({ id: 'fruit', parentId: 'produce', children: [] });

    await service.list({ categoryId: 'fruit' });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ categoryId: { in: ['fruit'] } }),
      }),
    );
  });

  it('requires an image file', async () => {
    await expect(service.uploadImage('vendor-user')).rejects.toThrow('An image file is required.');
    expect(prisma.vendor.findUnique).not.toHaveBeenCalled();
  });

  it('rejects content whose bytes do not match a supported image', async () => {
    await expect(
      service.uploadImage('vendor-user', {
        buffer: Buffer.from('<script>alert(1)</script>'),
        mimetype: 'image/png',
      } as Express.Multer.File),
    ).rejects.toThrow('The uploaded file is not a supported JPEG, PNG, GIF, or WebP image.');
    expect(prisma.vendor.findUnique).not.toHaveBeenCalled();
  });

  it('stores a verified image for an approved vendor and returns its public URL', async () => {
    prisma.vendor.findUnique.mockResolvedValue({ status: VendorStatus.APPROVED });
    const file = {
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      mimetype: 'image/png',
    } as Express.Multer.File;

    const result = await service.uploadImage('vendor-user', file);
    const filePath = join(process.cwd(), 'uploads', 'products', result.imageUrl.split('/').pop()!);
    uploadedFiles.push(filePath);

    expect(result.imageUrl).toMatch(/^\/uploads\/products\/[0-9a-f-]+\.png$/);
    await expect(readFile(filePath)).resolves.toEqual(file.buffer);
    expect(prisma.vendor.findUnique).toHaveBeenCalledWith({
      where: { userId: 'vendor-user' },
      select: { status: true },
    });
  });

  afterEach(async () => {
    await Promise.all(uploadedFiles.map((file) => rm(file, { force: true })));
  });
});
