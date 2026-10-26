import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../common/auth';
import { UpdateInventoryDto } from '../common/dto';
import { InventoryService } from './inventory.service';

@Controller('vendor/inventory')
@ApiBearerAuth()
@ApiTags('Vendor')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.VENDOR)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.inventoryService.list(user.sub);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: UpdateInventoryDto) {
    return this.inventoryService.update(user.sub, id, body.quantity);
  }
}
