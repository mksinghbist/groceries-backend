import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../common/auth';
import { CreateStoreDto } from '../common/dto';
import { VendorsService } from './vendors.service';

@Controller('vendors')
@ApiBearerAuth()
@ApiTags('Vendor')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.VENDOR)
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.vendorsService.getMe(user.sub);
  }

  @Post('stores')
  createStore(@CurrentUser() user: AuthUser, @Body() body: CreateStoreDto) {
    return this.vendorsService.createStore(user.sub, body);
  }
}
