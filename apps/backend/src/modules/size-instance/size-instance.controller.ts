import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { SizeInstanceService } from './size-instance.service';
import {
  CreateSizeInstanceDto,
  CreateSizeInstancesBulkDto,
} from '../size-schema/dto/size-schema.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import type { TenantContext } from '@closetrent/types';

@Controller('owner/size-instances')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('owner', 'manager')
@RequirePermission('manage_products')
export class SizeInstanceController {
  constructor(private readonly service: SizeInstanceService) {}

  @Get()
  listBySchema(
    @CurrentTenant() tenant: TenantContext,
    @Query('schemaId', ParseUUIDPipe) schemaId: string,
  ) {
    return this.service.listBySchema(tenant.id, schemaId);
  }

  @Post()
  create(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateSizeInstanceDto) {
    return this.service.create(tenant.id, dto);
  }

  @Post('bulk')
  createBulk(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateSizeInstancesBulkDto,
  ) {
    return this.service.createBulk(tenant.id, dto.schemaId, dto.labels);
  }

  @Delete(':id')
  delete(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.delete(tenant.id, id);
  }
}
