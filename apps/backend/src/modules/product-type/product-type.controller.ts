import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ProductTypeService } from './product-type.service';
import { CreateProductTypeDto, UpdateProductTypeDto } from '../size-schema/dto/size-schema.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import type { TenantContext } from '@closetrent/types';

@Controller('owner/product-types')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('owner', 'manager')
export class ProductTypeController {
  constructor(private readonly service: ProductTypeService) {}

  @Get()
  list(@CurrentTenant() tenant: TenantContext) {
    return this.service.list(tenant.id);
  }

  @Get(':id')
  getById(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getById(tenant.id, id);
  }

  @Post()
  create(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateProductTypeDto) {
    return this.service.create(tenant.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductTypeDto,
  ) {
    return this.service.update(tenant.id, id, dto);
  }

  @Delete(':id')
  delete(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.delete(tenant.id, id);
  }
}
