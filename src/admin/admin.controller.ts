import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, Roles, RolesGuard } from '../common/auth';
import { CreateAdminDto, CreateDeliveryAgentDto } from '../common/dto';
import { AdminService } from './admin.service';

@Controller('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  dashboard() {
    return this.adminService.dashboard();
  }

  @Get('vendors')
  listVendors() {
    return this.adminService.listVendors();
  }

  @Patch('vendors/:id/approve')
  approveVendor(@Param('id') vendorId: string) {
    return this.adminService.approveVendor(vendorId);
  }

  @Post('admins')
  createAdmin(@Body() body: CreateAdminDto) {
    return this.adminService.createAdmin(body);
  }

  @Post('delivery-agents')
  createDeliveryAgent(@Body() body: CreateDeliveryAgentDto) {
    return this.adminService.createDeliveryAgent(body);
  }
}
