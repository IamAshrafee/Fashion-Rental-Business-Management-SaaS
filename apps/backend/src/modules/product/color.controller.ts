import {
  Controller,
  Get,
} from '@nestjs/common';
import { ColorService } from './color.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantContext } from '@closetrent/types';

@Controller('colors')
export class ColorController {
  constructor(private readonly colorService: ColorService) {}

  /**
   * GET /api/v1/colors
   * List all system colors + tenant custom colors.
   */
  @Public()
  @Get()
  async listColors(@CurrentTenant() tenant: TenantContext) {
    return this.colorService.listColors(tenant?.id);
  }
}
