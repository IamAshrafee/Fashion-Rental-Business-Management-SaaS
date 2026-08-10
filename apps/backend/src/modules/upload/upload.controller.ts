import {
  Controller,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Get,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantContext } from '@closetrent/types';
import { ReorderDto } from '../product/dto/product.dto';

@Controller('owner/upload')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('product-image')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async uploadProductImage(
    @CurrentTenant() tenant: TenantContext,
    @UploadedFile() file: Express.Multer.File,
    @Body('variantId', new ParseUUIDPipe({ version: '4' })) variantId: string,
    @Body('isFeatured') isFeatured?: string,
  ) {
    return this.uploadService.uploadProductImage(
      tenant.id,
      variantId,
      file,
      isFeatured === 'true',
    );
  }

  @Post('product-images')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadProductImages(
    @CurrentTenant() tenant: TenantContext,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('variantId', new ParseUUIDPipe({ version: '4' })) variantId: string,
  ) {
    return this.uploadService.uploadProductImages(tenant.id, variantId, files);
  }

  @Delete('product-image/:imageId')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.OK)
  async deleteProductImage(
    @CurrentTenant() tenant: TenantContext,
    @Param('imageId', new ParseUUIDPipe({ version: '4' })) imageId: string,
  ) {
    return this.uploadService.deleteProductImage(tenant.id, imageId);
  }

  @Patch('product-images/reorder')
  @Roles('owner', 'manager')
  async reorderImages(
    @CurrentTenant() tenant: TenantContext,
    @Body('variantId', new ParseUUIDPipe({ version: '4' })) variantId: string,
    @Body() dto: ReorderDto,
  ) {
    return this.uploadService.reorderImages(tenant.id, variantId, dto.ids);
  }

  @Post('logo')
  @Roles('owner')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(
    @CurrentTenant() tenant: TenantContext,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.uploadService.uploadLogo(tenant.id, file);
  }

  @Post('banners')
  @Roles('owner')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async uploadBanner(
    @CurrentTenant() tenant: TenantContext,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.uploadService.uploadBanner(tenant.id, file);
  }

  @Post('damage-photos')
  @Roles('owner', 'manager', 'staff')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FilesInterceptor('files', 4))
  async uploadDamagePhotos(
    @CurrentTenant() tenant: TenantContext,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('bookingItemId') bookingItemId: string,
  ) {
    return this.uploadService.uploadDamagePhotos(tenant.id, bookingItemId, files);
  }

  @Post('inventory-photos')
  @Roles('owner', 'manager', 'staff')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadInventoryPhotos(
    @CurrentTenant() tenant: TenantContext,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('stockUnitId') stockUnitId: string,
  ) {
    return this.uploadService.uploadInventoryPhotos(tenant.id, stockUnitId, files);
  }

  @Get('inventory-media-url')
  @Roles('owner', 'manager', 'staff')
  async getInventoryMediaUrl(
    @CurrentTenant() tenant: TenantContext,
    @Query('objectKey') objectKey: string,
  ) {
    return this.uploadService.getInventoryMediaUrl(tenant.id, objectKey);
  }
}
