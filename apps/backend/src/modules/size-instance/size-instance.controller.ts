import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SizeInstanceService } from './size-instance.service';
import { CreateSizeInstanceDto } from '../size-schema/dto/size-schema.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('owner/size-instances')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner', 'manager')
export class SizeInstanceController {
  constructor(private readonly service: SizeInstanceService) {}

  @Get()
  listBySchema(@Query('schemaId') schemaId: string) {
    return this.service.listBySchema(schemaId);
  }

  @Post()
  create(@Body() dto: CreateSizeInstanceDto) {
    return this.service.create(dto);
  }

  @Post('bulk')
  createBulk(@Body() body: { schemaId: string; labels: string[] }) {
    return this.service.createBulk(body.schemaId, body.labels);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
