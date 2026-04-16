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
  Req,
} from '@nestjs/common';
import { SizeSchemaService } from './size-schema.service';
import {
  CreateSizeSchemaDto,
  UpdateSizeSchemaDto,
  CreateSizeChartDto,
} from './dto/size-schema.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('owner/size-schemas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner', 'manager')
export class SizeSchemaController {
  constructor(private readonly service: SizeSchemaService) {}

  @Get()
  list(@Req() req: any, @Query('status') status?: string) {
    return this.service.listSchemas(req.user.tenantId, status);
  }

  @Get(':id')
  getById(@Req() req: any, @Param('id') id: string) {
    return this.service.getSchema(req.user.tenantId, id);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateSizeSchemaDto) {
    return this.service.createSchema(req.user.tenantId, dto);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateSizeSchemaDto) {
    return this.service.updateSchema(req.user.tenantId, id, dto);
  }

  @Post(':id/activate')
  activate(@Req() req: any, @Param('id') id: string) {
    return this.service.activateSchema(req.user.tenantId, id);
  }

  @Post(':id/deprecate')
  deprecate(@Req() req: any, @Param('id') id: string) {
    return this.service.deprecateSchema(req.user.tenantId, id);
  }

  @Delete(':id')
  delete(@Req() req: any, @Param('id') id: string) {
    return this.service.deleteSchema(req.user.tenantId, id);
  }

  // ─── Size Charts ────────────────────────────────────────────────────────────

  @Get('charts/list')
  listCharts(@Req() req: any, @Query('schemaId') schemaId?: string) {
    return this.service.listSizeCharts(req.user.tenantId, schemaId);
  }

  @Get('charts/:chartId')
  getChart(@Req() req: any, @Param('chartId') chartId: string) {
    return this.service.getSizeChart(req.user.tenantId, chartId);
  }

  @Post('charts')
  createChart(@Req() req: any, @Body() dto: CreateSizeChartDto) {
    return this.service.createSizeChart(req.user.tenantId, dto);
  }

  @Delete('charts/:chartId')
  deleteChart(@Req() req: any, @Param('chartId') chartId: string) {
    return this.service.deleteSizeChart(req.user.tenantId, chartId);
  }
}
