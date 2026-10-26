import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AuthUser, CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../common/auth';
import { CreateAddressDto } from '../common/dto';
import { AddressesService } from './addresses.service';

@Controller('addresses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER)
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.addressesService.list(user.sub);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateAddressDto) {
    return this.addressesService.create(user.sub, body);
  }
}
