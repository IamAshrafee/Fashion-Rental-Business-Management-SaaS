import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser, TenantContext } from '@closetrent/types';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import {
  PublishOnboardedProductDto,
  SaveOpeningInventoryDto,
  SaveProductBasicsDto,
  SaveProductContentDto,
  SaveProductPricingSectionDto,
  SaveProductSkusDto,
  StartProductOnboardingDto,
} from './dto/product-onboarding.dto';
import { ProductOnboardingService } from './product-onboarding.service';

@Controller('owner/product-onboardings')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class ProductOnboardingController {
  constructor(private readonly onboarding: ProductOnboardingService) {}

  @Post()
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.CREATED)
  start(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Body() dto: StartProductOnboardingDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.onboarding.start(tenant.id, user.id, dto, idempotencyKey);
  }

  @Get(':productId')
  @Roles('owner', 'manager', 'staff')
  get(
    @CurrentTenant() tenant: TenantContext,
    @Param('productId') productId: string,
  ) {
    return this.onboarding.get(tenant.id, productId);
  }

  @Put(':productId/basics')
  @Roles('owner', 'manager')
  saveBasics(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
    @Body() dto: SaveProductBasicsDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.onboarding.saveBasics(tenant.id, productId, user.id, dto, idempotencyKey);
  }

  @Put(':productId/skus')
  @Roles('owner', 'manager')
  saveSkus(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
    @Body() dto: SaveProductSkusDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.onboarding.saveSkus(tenant.id, productId, user.id, dto, idempotencyKey);
  }

  @Put(':productId/content')
  @Roles('owner', 'manager')
  saveContent(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
    @Body() dto: SaveProductContentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.onboarding.saveContent(tenant.id, productId, user.id, dto, idempotencyKey);
  }

  @Put(':productId/pricing')
  @Roles('owner', 'manager')
  savePricing(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
    @Body() dto: SaveProductPricingSectionDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.onboarding.savePricing(tenant.id, productId, user.id, dto, idempotencyKey);
  }

  @Put(':productId/opening-inventory')
  @Roles('owner', 'manager')
  saveOpeningInventory(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
    @Body() dto: SaveOpeningInventoryDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.onboarding.saveOpeningInventory(
      tenant.id,
      productId,
      user.id,
      dto,
      idempotencyKey,
    );
  }

  @Post(':productId/publish')
  @Roles('owner', 'manager')
  publish(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
    @Body() dto: PublishOnboardedProductDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.onboarding.publish(tenant.id, productId, user.id, dto, idempotencyKey);
  }
}
