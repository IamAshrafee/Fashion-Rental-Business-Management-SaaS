import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PricingEngineModule } from '../pricing-engine/pricing-engine.module';

// Services
import { CategoryService } from './category.service';
import { ColorService } from './color.service';
import { ProductService } from './product.service';
import { VariantService } from './variant.service';
import { SearchService } from './search.service';
import { ProductOnboardingService } from './product-onboarding.service';

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
import { ProductOnboardingController } from './product-onboarding.controller';

/**
 * Product Module — P04 Product Management.
 *
 * Covers: Categories, Colors, Products, Variants, Pricing, Services,
 * Sizes, FAQs, Details, and Search.
 */
@Module({
  imports: [PrismaModule, PricingEngineModule],
  controllers: [
    // Guest (public)
    CategoryGuestController,
    EventGuestController,
    ColorController,
    ProductGuestController,
    // Owner (auth required)
    CategoryOwnerController,
    SubcategoryOwnerController,
    EventOwnerController,
    ProductOwnerController,
    ProductOnboardingController,
  ],
  providers: [
    CategoryService,
    ColorService,
    ProductService,
    VariantService,
    SearchService,
    ProductOnboardingService,
  ],
  exports: [
    ProductService,
    CategoryService,
    ColorService,
    SearchService,
  ],
})
export class ProductModule {}
