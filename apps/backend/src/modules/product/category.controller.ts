import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CategoryService } from './category.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateSubcategoryDto,
  UpdateSubcategoryDto,
  CreateEventDto,
  UpdateEventDto,
} from './dto/create-category.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantContext } from '@closetrent/types';

// =========================================================================
// GUEST CONTROLLERS (public)
// =========================================================================

@Controller('categories')
export class CategoryGuestController {
  constructor(private readonly categoryService: CategoryService) {}

  @Public()
  @Get()
  async listCategories(@CurrentTenant() tenant: TenantContext) {
    return this.categoryService.listCategories(tenant.id);
  }
}

@Controller('events')
export class EventGuestController {
  constructor(private readonly categoryService: CategoryService) {}

  @Public()
  @Get()
  async listEvents(@CurrentTenant() tenant: TenantContext) {
    return this.categoryService.listEvents(tenant.id);
  }
}

// =========================================================================
// OWNER CONTROLLERS (auth required)
// =========================================================================

@Controller('owner/categories')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class CategoryOwnerController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @Roles('owner', 'manager')
  async listCategories(@CurrentTenant() tenant: TenantContext) {
    return this.categoryService.listCategoriesOwner(tenant.id);
  }

  @Post()
  @Roles('owner')
  @HttpCode(HttpStatus.CREATED)
  async createCategory(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.categoryService.createCategory(tenant.id, dto);
  }

  @Patch(':id')
  @Roles('owner')
  async updateCategory(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoryService.updateCategory(tenant.id, id, dto);
  }

  @Delete(':id')
  @Roles('owner')
  @HttpCode(HttpStatus.OK)
  async deleteCategory(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.categoryService.deleteCategory(tenant.id, id);
  }

  // --- Subcategories ---

  @Post(':id/subcategories')
  @Roles('owner')
  @HttpCode(HttpStatus.CREATED)
  async createSubcategory(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') categoryId: string,
    @Body() dto: CreateSubcategoryDto,
  ) {
    return this.categoryService.createSubcategory(tenant.id, categoryId, dto);
  }
}

@Controller('owner/subcategories')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class SubcategoryOwnerController {
  constructor(private readonly categoryService: CategoryService) {}

  @Patch(':id')
  @Roles('owner')
  async updateSubcategory(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateSubcategoryDto,
  ) {
    return this.categoryService.updateSubcategory(tenant.id, id, dto);
  }

  @Delete(':id')
  @Roles('owner')
  @HttpCode(HttpStatus.OK)
  async deleteSubcategory(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.categoryService.deleteSubcategory(tenant.id, id);
  }
}

@Controller('owner/events')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class EventOwnerController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @Roles('owner', 'manager')
  async listEvents(@CurrentTenant() tenant: TenantContext) {
    return this.categoryService.listEventsOwner(tenant.id);
  }

  @Post()
  @Roles('owner')
  @HttpCode(HttpStatus.CREATED)
  async createEvent(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateEventDto,
  ) {
    return this.categoryService.createEvent(tenant.id, dto);
  }

  @Patch(':id')
  @Roles('owner')
  async updateEvent(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
  ) {
    return this.categoryService.updateEvent(tenant.id, id, dto);
  }

  @Delete(':id')
  @Roles('owner')
  @HttpCode(HttpStatus.OK)
  async deleteEvent(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.categoryService.deleteEvent(tenant.id, id);
  }
}
