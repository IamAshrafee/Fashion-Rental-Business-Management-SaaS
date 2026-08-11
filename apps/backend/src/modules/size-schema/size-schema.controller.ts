import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  ParseEnumPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SizeSchemaService } from './size-schema.service';
import {
  CreateSizeChartDto,
  CreateSizeSchemaDto,
  UpdateSizeChartDto,
  UpdateSizeSchemaDto,
} from './dto/size-schema.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import type { TenantContext } from '@closetrent/types';
import { SizeSchemaStatus } from '@prisma/client';

@Controller('owner/size-schemas')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('owner', 'manager')
@RequirePermission('manage_products')
export class SizeSchemaController {
  constructor(private readonly service: SizeSchemaService) {}

  @Get()
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query('status', new ParseEnumPipe(SizeSchemaStatus, { optional: true }))
    status?: SizeSchemaStatus,
  ) {
    return this.service.listSchemas(tenant.id, status);
  }

  // Static chart routes must remain above the dynamic ':id' route.
  @Get('charts/list')
  listCharts(
    @CurrentTenant() tenant: TenantContext,
    @Query('schemaId') schemaId?: string,
  ) {
    return this.service.listSizeCharts(tenant.id, schemaId);
  }

  @Get('charts/:chartId')
  getChart(
    @CurrentTenant() tenant: TenantContext,
    @Param('chartId', ParseUUIDPipe) chartId: string,
  ) {
    return this.service.getSizeChart(tenant.id, chartId);
  }

  @Post('charts')
  createChart(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateSizeChartDto,
  ) {
    return this.service.createSizeChart(tenant.id, dto);
  }

  @Patch('charts/:chartId')
  updateChart(
    @CurrentTenant() tenant: TenantContext,
    @Param('chartId', ParseUUIDPipe) chartId: string,
    @Body() dto: UpdateSizeChartDto,
  ) {
    return this.service.updateSizeChart(tenant.id, chartId, dto);
  }

  @Delete('charts/:chartId')
  deleteChart(
    @CurrentTenant() tenant: TenantContext,
    @Param('chartId', ParseUUIDPipe) chartId: string,
  ) {
    return this.service.deleteSizeChart(tenant.id, chartId);
  }

  @Get(':id')
  getById(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getSchema(tenant.id, id);
  }

  @Post()
  create(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateSizeSchemaDto) {
    return this.service.createSchema(tenant.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSizeSchemaDto,
  ) {
    return this.service.updateSchema(tenant.id, id, dto);
  }

  @Post(':id/activate')
  activate(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.activateSchema(tenant.id, id);
  }

  @Post(':id/deprecate')
  deprecate(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.deprecateSchema(tenant.id, id);
  }

  @Delete(':id')
  delete(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.deleteSchema(tenant.id, id);
  }
}
