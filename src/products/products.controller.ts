import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { AuthUser, CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../common/auth';
import { CreateProductDto, UpdateProductDto } from '../common/dto';
import { ProductsService } from './products.service';

@Controller()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('products')
  list(@Query('categoryId') categoryId?: string, @Query('storeId') storeId?: string) {
    return this.productsService.list({ categoryId, storeId });
  }

  @Post('vendor/products')
  @ApiBearerAuth()
  @ApiTags('Vendor')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  create(@CurrentUser() user: AuthUser, @Body() body: CreateProductDto) {
    return this.productsService.create(user.sub, body);
  }

  @Post('vendor/products/upload-image')
  @ApiBearerAuth()
  @ApiTags('Vendor')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['image'],
      properties: { image: { type: 'string', format: 'binary' } },
    },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @UseInterceptors(FileInterceptor('image', {
    storage: memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (_request, file, callback) => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.mimetype)) {
        callback(new BadRequestException('Upload a JPEG, PNG, GIF, or WebP image.'), false);
        return;
      }
      callback(null, true);
    },
  }))
  uploadProductImage(@CurrentUser() user: AuthUser, @UploadedFile() file?: Express.Multer.File) {
    return this.productsService.uploadImage(user.sub, file);
  }

  @Patch('vendor/products/:id')
  @ApiBearerAuth()
  @ApiTags('Vendor')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: UpdateProductDto) {
    return this.productsService.update(user.sub, id, body);
  }
}
