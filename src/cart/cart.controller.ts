import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AuthUser, CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../common/auth';
import { AddCartItemDto } from '../common/dto';
import { CartService } from './cart.service';

@Controller('cart')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.cartService.get(user.sub);
  }

  @Post('items')
  addItem(@CurrentUser() user: AuthUser, @Body() body: AddCartItemDto) {
    return this.cartService.addItem(user.sub, body);
  }
}
