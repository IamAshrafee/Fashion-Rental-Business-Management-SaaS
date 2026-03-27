import { Module, OnModuleInit } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';

// Services
import { CategoryService } from './category.service';
import { ColorService } from './color.service';
import { ProductService } from './product.service';
import { VariantService } from './variant.service';
import { SearchService } from './search.service';
import { InventoryService } from './inventory.service';

// Controllers — Category
import {
  CategoryGuestController,
  EventGuestController,
  CategoryOwnerController,
  SubcategoryOwnerController,
  EventOwnerController,
} from './category.controller';

// Controllers — Color
import { ColorController } from './color.controller';

// Controllers — Product
import {
  ProductGuestController,
  ProductOwnerController,
} from './product.controller';

// Controllers — Inventory
import {
  InventoryGuestController,
  InventoryOwnerController,
} from './inventory.controller';

/**
 * Product Module — P04 Product Management.
 *
 * Covers: Categories, Colors, Products, Variants, Pricing, Services,
 * Sizes, FAQs, Details, Search, and Inventory/Availability.
 */
@Module({
  imports: [PrismaModule],
  controllers: [
    // Guest (public)
    CategoryGuestController,
    EventGuestController,
    ColorController,
    ProductGuestController,
    InventoryGuestController,
    // Owner (auth required)
    CategoryOwnerController,
    SubcategoryOwnerController,
    EventOwnerController,
    ProductOwnerController,
    InventoryOwnerController,
  ],
  providers: [
    CategoryService,
    ColorService,
    ProductService,
    VariantService,
    SearchService,
    InventoryService,
  ],
  exports: [
    ProductService,
    CategoryService,
    ColorService,
    InventoryService,
    SearchService,
  ],
})
export class ProductModule implements OnModuleInit {
  constructor(private readonly colorService: ColorService) {}

  async onModuleInit() {
    // Seed system colors on startup
    await this.colorService.seedSystemColors();
  }
}
