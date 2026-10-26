import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../common/auth';
import { CreateOrderDto, UpdateOrderStatusDto } from '../common/dto';
import { OrdersService } from './orders.service';

@Controller()
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('orders')
  @Roles(UserRole.CUSTOMER)
  create(@CurrentUser() user: AuthUser, @Body() body: CreateOrderDto) {
    return this.ordersService.create(user.sub, body.addressId);
  }

  @Get('orders')
  @ApiTags('Orders')
  @Roles(UserRole.CUSTOMER, UserRole.VENDOR, UserRole.ADMIN)
  list(@CurrentUser() user: AuthUser) {
    return this.ordersService.listForUser(user.sub, user.role);
  }

  @Patch('vendor/orders/:id/status')
  @ApiTags('Vendor')
  @Roles(UserRole.VENDOR)
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(user.sub, id, body.status);
  }
}
