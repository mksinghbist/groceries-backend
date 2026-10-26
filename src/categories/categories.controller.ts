import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard, Roles, RolesGuard } from '../common/auth';
import { CreateCategoryDto, CreateSubcategoryDto } from '../common/dto';
import { CategoriesService } from './categories.service';

@Controller()
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get('categories')
  list() {
    return this.categoriesService.list();
  }

  @Post('admin/categories')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@Body() body: CreateCategoryDto) {
    return this.categoriesService.create(body);
  }

  @Post('admin/categories/:parentId/subcategories')
  @ApiBearerAuth()
  @ApiParam({ name: 'parentId', description: 'ID of the top-level parent category' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  createSubcategory(@Param('parentId') parentId: string, @Body() body: CreateSubcategoryDto) {
    return this.categoriesService.createSubcategory(parentId, body);
  }
}
