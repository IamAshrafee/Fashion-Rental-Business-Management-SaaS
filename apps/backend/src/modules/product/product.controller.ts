import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { VariantService } from './variant.service';
import { SearchService } from './search.service';
import {
  UpdateProductDto,
  UpdateProductStatusDto,
  ProductQueryDto,
  OwnerProductQueryDto,
  StorefrontShowcaseQueryDto,
  CreateVariantDto,
  UpdateVariantDto,
  ReorderDto,
  CreateFaqDto,
  UpdateFaqDto,
  CreateDetailHeaderDto,
  UpdateDetailHeaderDto,
  DetailEntryDto,
} from './dto/product.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantContext, AuthUser } from '@closetrent/types';

// =========================================================================
// GUEST CONTROLLER
// =========================================================================

@Controller('products')
export class ProductGuestController {
  constructor(
    private readonly productService: ProductService,
    private readonly searchService: SearchService,
  ) {}

  @Public()
  @Get('search')
  async search(
    @CurrentTenant() tenant: TenantContext,
    @Query('q') q: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.searchService.search(tenant.id, q || '', page || 1, limit || 20);
  }

  @Public()
  @Get('search/suggest')
  async suggest(
    @CurrentTenant() tenant: TenantContext,
    @Query('q') q: string,
  ) {
    return this.searchService.suggest(tenant.id, q || '');
  }

  @Public()
  @Get('filters')
  async getFilters(@CurrentTenant() tenant: TenantContext) {
    return this.searchService.getFilterCounts(tenant.id);
  }

  // --- Storefront Showcase APIs (landing page) ---
  // IMPORTANT: These static routes MUST be above ':slug' to avoid route collision.

  @Public()
  @Get('latest')
  async getLatestArrivals(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: StorefrontShowcaseQueryDto,
  ) {
    return this.productService.getLatestArrivals(tenant.id, query.limit);
  }

  @Public()
  @Get('popular')
  async getPopularProducts(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: StorefrontShowcaseQueryDto,
  ) {
    return this.productService.getPopularProducts(tenant.id, query.limit);
  }

  @Public()
  @Get('popular/category')
  async getPopularByCategory(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: StorefrontShowcaseQueryDto,
  ) {
    return this.productService.getPopularByCategory(tenant.id, query.slug, query.limit);
  }

  @Public()
  @Get('popular/subcategory')
  async getPopularBySubcategory(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: StorefrontShowcaseQueryDto,
  ) {
    return this.productService.getPopularBySubcategory(tenant.id, query.slug, query.limit);
  }

  @Public()
  @Get('popular/event')
  async getPopularByEvent(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: StorefrontShowcaseQueryDto,
  ) {
    return this.productService.getPopularByEvent(tenant.id, query.slug, query.limit);
  }

  // --- Master product listing ---

  @Public()
  @Get()
  async listProducts(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ProductQueryDto,
  ) {
    return this.productService.listGuest(tenant.id, query);
  }

  @Public()
  @Get(':slug')
  async getProduct(
    @CurrentTenant() tenant: TenantContext,
    @Param('slug') slug: string,
  ) {
    return this.productService.getBySlug(tenant.id, slug);
  }
}

// =========================================================================
// OWNER CONTROLLER
// =========================================================================

@Controller('owner/products')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class ProductOwnerController {
  constructor(
    private readonly productService: ProductService,
    private readonly variantService: VariantService,
  ) {}

  // --- Product CRUD ---

  @Get()
  @Roles('owner', 'manager')
  async listProducts(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: OwnerProductQueryDto,
  ) {
    return this.productService.listOwner(tenant.id, query);
  }

  // ⚠️ IMPORTANT: 'trash' must be BEFORE ':id' — otherwise NestJS treats 'trash' as an id param
  @Get('trash')
  @Roles('owner', 'manager')
  async listTrash(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: OwnerProductQueryDto,
  ) {
    return this.productService.listOwner(tenant.id, { ...query, status: 'trash' });
  }

  @Get(':id')
  @Roles('owner', 'manager', 'staff')
  async getProduct(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.productService.getById(tenant.id, id);
  }

  @Get(':id/readiness')
  @Roles('owner', 'manager', 'staff')
  async getReadiness(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.productService.getReadiness(tenant.id, id);
  }

  @Patch(':id')
  @Roles('owner', 'manager')
  async updateProduct(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productService.update(tenant.id, id, dto);
  }

  @Patch(':id/status')
  @Roles('owner', 'manager')
  async updateStatus(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateProductStatusDto,
  ) {
    return this.productService.updateStatus(tenant.id, id, dto.status);
  }

  @Delete(':id')
  @Roles('owner')
  @HttpCode(HttpStatus.OK)
  async deleteProduct(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.productService.softDelete(tenant.id, id, user.id);
  }

  @Post(':id/restore')
  @Roles('owner')
  async restoreProduct(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.productService.restore(tenant.id, id);
  }

  @Delete(':id/permanent')
  @Roles('owner')
  @HttpCode(HttpStatus.OK)
  async permanentDeleteProduct(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.productService.permanentDelete(tenant.id, id);
  }

  // --- Variants ---

  @Post(':id/variants')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.CREATED)
  async addVariant(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') productId: string,
    @Body() dto: CreateVariantDto,
  ) {
    return this.variantService.addVariant(tenant.id, productId, dto);
  }

  @Patch(':productId/variants/:variantId')
  @Roles('owner', 'manager')
  async updateVariant(
    @CurrentTenant() tenant: TenantContext,
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.variantService.updateVariant(tenant.id, productId, variantId, dto);
  }

  @Delete(':productId/variants/:variantId')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.OK)
  async deleteVariant(
    @CurrentTenant() tenant: TenantContext,
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
  ) {
    return this.variantService.deleteVariant(tenant.id, productId, variantId);
  }

  @Post(':id/variants/reorder')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.OK)
  async reorderVariants(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') productId: string,
    @Body() dto: ReorderDto,
  ) {
    return this.variantService.reorderVariants(tenant.id, productId, dto);
  }

  // --- FAQs ---

  @Post(':id/faqs')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.CREATED)
  async addFaq(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') productId: string,
    @Body() dto: CreateFaqDto,
  ) {
    return this.productService.addFaq(tenant.id, productId, dto);
  }

  @Patch(':productId/faqs/:faqId')
  @Roles('owner', 'manager')
  async updateFaq(
    @CurrentTenant() tenant: TenantContext,
    @Param('productId') productId: string,
    @Param('faqId') faqId: string,
    @Body() dto: UpdateFaqDto,
  ) {
    return this.productService.updateFaq(tenant.id, productId, faqId, dto);
  }

  @Delete(':productId/faqs/:faqId')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.OK)
  async deleteFaq(
    @CurrentTenant() tenant: TenantContext,
    @Param('productId') productId: string,
    @Param('faqId') faqId: string,
  ) {
    return this.productService.deleteFaq(tenant.id, productId, faqId);
  }

  // --- Detail Headers ---

  @Post(':id/details')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.CREATED)
  async addDetailHeader(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') productId: string,
    @Body() dto: CreateDetailHeaderDto,
  ) {
    return this.productService.addDetailHeader(tenant.id, productId, dto);
  }

  @Patch(':productId/details/:headerId')
  @Roles('owner', 'manager')
  async updateDetailHeader(
    @CurrentTenant() tenant: TenantContext,
    @Param('productId') productId: string,
    @Param('headerId') headerId: string,
    @Body() dto: UpdateDetailHeaderDto,
  ) {
    return this.productService.updateDetailHeader(tenant.id, productId, headerId, dto);
  }

  @Delete(':productId/details/:headerId')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.OK)
  async deleteDetailHeader(
    @CurrentTenant() tenant: TenantContext,
    @Param('productId') productId: string,
    @Param('headerId') headerId: string,
  ) {
    return this.productService.deleteDetailHeader(tenant.id, productId, headerId);
  }

  @Post(':productId/details/:headerId/entries')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.CREATED)
  async addDetailEntry(
    @CurrentTenant() tenant: TenantContext,
    @Param('productId') productId: string,
    @Param('headerId') headerId: string,
    @Body() dto: DetailEntryDto,
  ) {
    return this.productService.addDetailEntry(tenant.id, productId, headerId, dto);
  }

  @Delete(':productId/details/:headerId/entries/:entryId')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.OK)
  async deleteDetailEntry(
    @CurrentTenant() tenant: TenantContext,
    @Param('productId') productId: string,
    @Param('headerId') headerId: string,
    @Param('entryId') entryId: string,
  ) {
    return this.productService.deleteDetailEntry(tenant.id, productId, headerId, entryId);
  }
}
