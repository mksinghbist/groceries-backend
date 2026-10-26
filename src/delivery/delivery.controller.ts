import { Body, Controller, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../common/auth';
import { CreateDeliveryDto, UpdateDeliveryStatusDto } from '../common/dto';
import { DeliveryService } from './delivery.service';

@Controller()
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Post('vendor/orders/:id/delivery')
  @ApiTags('Vendor')
  @Roles(UserRole.VENDOR)
  assign(
    @CurrentUser() user: AuthUser,
    @Param('id') orderId: string,
    @Body() body: CreateDeliveryDto,
  ) {
    return this.deliveryService.assign(user.sub, orderId, body.agentId);
  }

  @Patch('delivery/orders/:id/status')
  @Roles(UserRole.DELIVERY)
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') orderId: string,
    @Body() body: UpdateDeliveryStatusDto,
  ) {
    return this.deliveryService.updateStatus(user.sub, orderId, body.status, body.trackingNote);
  }
}
