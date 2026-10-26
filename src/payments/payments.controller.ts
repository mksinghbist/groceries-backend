import { Body, Controller, Headers, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../common/auth';
import { CheckoutDto } from '../common/dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('checkout')
  @ApiBearerAuth()
  @ApiTags('Payments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  checkout(@CurrentUser() user: AuthUser, @Body() body: CheckoutDto) {
    return this.paymentsService.checkout(user.sub, body.orderId, body.paymentMethod);
  }

  @Patch('orders/:orderId/cash-on-delivery/collect')
  @ApiBearerAuth()
  @ApiTags('Payments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DELIVERY)
  collectCashOnDelivery(@CurrentUser() user: AuthUser, @Param('orderId') orderId: string) {
    return this.paymentsService.collectCashOnDelivery(user.sub, orderId);
  }

  @Post('webhook')
  webhook(@Req() request: Request & { rawBody?: Buffer }, @Headers('x-payment-signature') signature?: string) {
    return this.paymentsService.handleWebhook(request.rawBody, signature);
  }
}
