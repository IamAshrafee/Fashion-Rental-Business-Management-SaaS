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
  CreateProductDto,
  UpdateProductDto,
  UpdateProductStatusDto,
  ProductQueryDto,
  CreateVariantDto,
  UpdateVariantDto,
  ReorderDto,
  SetPricingDto,
  SetServicesDto,
  SetSizeDto,
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
import { TenantContext } from '@closetrent/types';
import { PrismaService } from '../../prisma/prisma.service';

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
    private readonly prisma: PrismaService,
  ) {}

  // --- Product CRUD ---

  @Get()
  @Roles('owner', 'manager')
  async listProducts(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ProductQueryDto,
  ) {
    return this.productService.listOwner(tenant.id, query);
  }

  @Post()
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.CREATED)
  async createProduct(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateProductDto,
  ) {
    return this.productService.create(tenant.id, dto);
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

  @Get(':id')
  @Roles('owner', 'manager', 'staff')
  async getProduct(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.productService.getById(tenant.id, id);
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
    @Param('id') id: string,
  ) {
    return this.productService.softDelete(tenant.id, id);
  }

  @Post(':id/restore')
  @Roles('owner')
  async restoreProduct(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.productService.restore(tenant.id, id);
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

  // --- Pricing ---

  @Post(':id/pricing')
  @Roles('owner', 'manager')
  async setPricing(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') productId: string,
    @Body() dto: SetPricingDto,
  ) {
    // Upsert pricing via product update
    return this.productService.update(tenant.id, productId, { pricing: dto });
  }

  // --- Services ---

  @Post(':id/services')
  @Roles('owner', 'manager')
  async setServices(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') productId: string,
    @Body() dto: SetServicesDto,
  ) {
    return this.productService.update(tenant.id, productId, { services: dto });
  }

  // --- Size ---

  @Post(':id/size')
  @Roles('owner', 'manager')
  async setSize(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') productId: string,
    @Body() dto: SetSizeDto,
  ) {
    return this.productService.update(tenant.id, productId, { size: dto });
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
    const maxSeq = await this.prisma.productFaq.aggregate({
      where: { productId },
      _max: { sequence: true },
    });

    return this.prisma.productFaq.create({
      data: {
        tenantId: tenant.id,
        productId,
        question: dto.question,
        answer: dto.answer,
        sequence: (maxSeq._max.sequence ?? -1) + 1,
      },
    });
  }

  @Patch(':productId/faqs/:faqId')
  @Roles('owner', 'manager')
  async updateFaq(
    @Param('faqId') faqId: string,
    @Body() dto: UpdateFaqDto,
  ) {
    return this.prisma.productFaq.update({
      where: { id: faqId },
      data: dto,
    });
  }

  @Delete(':productId/faqs/:faqId')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.OK)
  async deleteFaq(@Param('faqId') faqId: string) {
    await this.prisma.productFaq.delete({ where: { id: faqId } });
    return { message: 'FAQ deleted' };
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
    const header = await this.prisma.productDetailHeader.create({
      data: {
        tenantId: tenant.id,
        productId,
        headerName: dto.headerName,
        sequence: dto.sequence ?? 0,
      },
    });

    if (dto.entries?.length) {
      await this.prisma.productDetailEntry.createMany({
        data: dto.entries.map((entry, i) => ({
          headerId: header.id,
          key: entry.key,
          value: entry.value,
          sequence: i,
        })),
      });
    }

    return this.prisma.productDetailHeader.findUnique({
      where: { id: header.id },
      include: { entries: { orderBy: { sequence: 'asc' } } },
    });
  }

  @Patch(':productId/details/:headerId')
  @Roles('owner', 'manager')
  async updateDetailHeader(
    @Param('headerId') headerId: string,
    @Body() dto: UpdateDetailHeaderDto,
  ) {
    return this.prisma.productDetailHeader.update({
      where: { id: headerId },
      data: dto,
    });
  }

  @Delete(':productId/details/:headerId')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.OK)
  async deleteDetailHeader(@Param('headerId') headerId: string) {
    await this.prisma.productDetailHeader.delete({ where: { id: headerId } });
    return { message: 'Detail header deleted' };
  }

  @Post(':productId/details/:headerId/entries')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.CREATED)
  async addDetailEntry(
    @Param('headerId') headerId: string,
    @Body() dto: DetailEntryDto,
  ) {
    return this.prisma.productDetailEntry.create({
      data: {
        headerId,
        key: dto.key,
        value: dto.value,
      },
    });
  }

  @Delete(':productId/details/:headerId/entries/:entryId')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.OK)
  async deleteDetailEntry(@Param('entryId') entryId: string) {
    await this.prisma.productDetailEntry.delete({ where: { id: entryId } });
    return { message: 'Detail entry deleted' };
  }
}
