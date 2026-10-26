import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CategoriesService } from './categories.service';

describe('CategoriesService', () => {
  let service: CategoriesService;
  const prisma = {
    category: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [CategoriesService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(CategoriesService);
  });

  it('lists active top-level categories with their active children', async () => {
    const categories = [{ id: 'produce', name: 'Produce', children: [{ id: 'fruit', name: 'Fruit' }] }];
    prisma.category.findMany.mockResolvedValue(categories);

    await expect(service.list()).resolves.toEqual(categories);
    expect(prisma.category.findMany).toHaveBeenCalledWith({
      where: { isActive: true, parentId: null },
      orderBy: { name: 'asc' },
      include: { children: { where: { isActive: true }, orderBy: { name: 'asc' } } },
    });
  });

  it('creates a top-level category', async () => {
    prisma.category.create.mockResolvedValue({ id: 'produce', name: 'Produce', parentId: null });

    await expect(service.create({ name: 'Produce', slug: 'produce' })).resolves.toEqual({
      id: 'produce',
      name: 'Produce',
      parentId: null,
    });
    expect(prisma.category.create).toHaveBeenCalledWith({
      data: { name: 'Produce', slug: 'produce' },
    });
  });

  it('creates a subcategory linked to a top-level category', async () => {
    prisma.category.findUnique.mockResolvedValue({ id: 'produce', parentId: null });
    prisma.category.create.mockResolvedValue({ id: 'fruit', name: 'Fruit', parentId: 'produce' });

    await expect(
      service.createSubcategory('produce', { name: 'Fruit', slug: 'fruit' }),
    ).resolves.toEqual({ id: 'fruit', name: 'Fruit', parentId: 'produce' });
    expect(prisma.category.findUnique).toHaveBeenCalledWith({
      where: { id: 'produce' },
      select: { id: true, parentId: true },
    });
    expect(prisma.category.create).toHaveBeenCalledWith({
      data: { name: 'Fruit', slug: 'fruit', parent: { connect: { id: 'produce' } } },
    });
  });

  it('rejects a missing parent category', async () => {
    prisma.category.findUnique.mockResolvedValue(null);

    await expect(
      service.createSubcategory('missing', { name: 'Fruit', slug: 'fruit' }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.category.create).not.toHaveBeenCalled();
  });

  it('does not allow nested subcategories', async () => {
    prisma.category.findUnique.mockResolvedValue({ id: 'fruit', parentId: 'produce' });

    await expect(
      service.createSubcategory('fruit', { name: 'Citrus', slug: 'citrus' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.category.create).not.toHaveBeenCalled();
  });
});
