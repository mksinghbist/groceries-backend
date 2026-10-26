import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, CreateSubcategoryDto } from '../common/dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.category.findMany({
      where: { isActive: true, parentId: null },
      orderBy: { name: 'asc' },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
      },
    });
  }

  create(input: CreateCategoryDto) {
    return this.prisma.category.create({ data: input });
  }

  async createSubcategory(parentId: string, input: CreateSubcategoryDto) {
    const parent = await this.prisma.category.findUnique({
      where: { id: parentId },
      select: { id: true, parentId: true },
    });
    if (!parent) throw new NotFoundException('Parent category not found.');
    if (parent.parentId) throw new BadRequestException('Subcategories cannot have child categories.');
    return this.prisma.category.create({
      data: { ...input, parent: { connect: { id: parentId } } },
    });
  }
}
