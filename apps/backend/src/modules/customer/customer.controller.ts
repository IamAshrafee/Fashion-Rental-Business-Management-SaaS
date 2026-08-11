import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthUser, TenantContext } from '@closetrent/types';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CustomerService } from './customer.service';
import {
  AddAddressDto,
  AddIdentityDto,
  AddNoteDto,
  AssignTagDto,
  CreateCustomerDto,
  CreateTagDefinitionDto,
  CustomerQueryDto,
  MergeCustomerDto,
  RecordConsentDto,
  SetPrimaryIdentityDto,
  UpdateAddressDto,
  UpdateCustomerDto,
} from './dto/customer.dto';

@Controller('owner/customers')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get('lookup')
  @Roles('owner', 'manager', 'staff')
  lookup(@CurrentTenant() tenant: TenantContext, @Query('phone') phone: string) {
    return this.customerService.lookupByPhone(tenant.id, phone);
  }

  @Get('tags')
  @Roles('owner', 'manager', 'staff')
  listTags(@CurrentTenant() tenant: TenantContext) {
    return this.customerService.listTenantTags(tenant.id);
  }

  @Post('tags')
  @Roles('owner', 'manager')
  createTag(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateTagDefinitionDto) {
    return this.customerService.createTagDefinition(tenant.id, dto);
  }

  @Get()
  @Roles('owner', 'manager', 'staff')
  list(@CurrentTenant() tenant: TenantContext, @Query() query: CustomerQueryDto) {
    return this.customerService.list(tenant.id, query);
  }

  @Get(':id')
  @Roles('owner', 'manager', 'staff')
  getById(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.customerService.getById(tenant.id, id);
  }

  @Post()
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentTenant() tenant: TenantContext, @CurrentUser() user: AuthUser, @Body() dto: CreateCustomerDto) {
    return this.customerService.create(tenant.id, dto, user.id);
  }

  @Patch(':id')
  @Roles('owner', 'manager')
  update(@CurrentTenant() tenant: TenantContext, @CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customerService.update(tenant.id, id, dto, user.id);
  }

  @Post(':id/identities')
  @Roles('owner', 'manager')
  addIdentity(@CurrentTenant() tenant: TenantContext, @CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddIdentityDto) {
    return this.customerService.addIdentity(tenant.id, id, dto, user.id);
  }

  @Patch(':id/identities/primary')
  @Roles('owner', 'manager')
  setPrimaryIdentity(@CurrentTenant() tenant: TenantContext, @Param('id') id: string, @Body() dto: SetPrimaryIdentityDto) {
    return this.customerService.setPrimaryIdentity(tenant.id, id, dto.identityId);
  }

  @Delete(':id/identities/:identityId')
  @Roles('owner', 'manager')
  removeIdentity(@CurrentTenant() tenant: TenantContext, @Param('id') id: string, @Param('identityId') identityId: string) {
    return this.customerService.removeIdentity(tenant.id, id, identityId);
  }

  @Post(':id/addresses')
  @Roles('owner', 'manager')
  addAddress(@CurrentTenant() tenant: TenantContext, @CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddAddressDto) {
    return this.customerService.addAddress(tenant.id, id, dto, user.id);
  }

  @Patch(':id/addresses/:addressId')
  @Roles('owner', 'manager')
  updateAddress(@CurrentTenant() tenant: TenantContext, @Param('id') id: string, @Param('addressId') addressId: string, @Body() dto: UpdateAddressDto) {
    return this.customerService.updateAddress(tenant.id, id, addressId, dto);
  }

  @Delete(':id/addresses/:addressId')
  @Roles('owner', 'manager')
  archiveAddress(@CurrentTenant() tenant: TenantContext, @Param('id') id: string, @Param('addressId') addressId: string) {
    return this.customerService.archiveAddress(tenant.id, id, addressId);
  }

  @Post(':id/notes')
  @Roles('owner', 'manager', 'staff')
  addNote(@CurrentTenant() tenant: TenantContext, @CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddNoteDto) {
    return this.customerService.addNote(tenant.id, id, dto, user.id);
  }

  @Post(':id/consents')
  @Roles('owner', 'manager')
  recordConsent(@CurrentTenant() tenant: TenantContext, @CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RecordConsentDto) {
    return this.customerService.recordConsent(tenant.id, id, dto, user.id);
  }

  @Post(':id/tags')
  @Roles('owner', 'manager')
  assignTag(@CurrentTenant() tenant: TenantContext, @CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AssignTagDto) {
    return this.customerService.assignTag(tenant.id, id, dto.tagId, user.id);
  }

  @Delete(':id/tags/:tagId')
  @Roles('owner', 'manager')
  unassignTag(@CurrentTenant() tenant: TenantContext, @Param('id') id: string, @Param('tagId') tagId: string) {
    return this.customerService.unassignTag(tenant.id, id, tagId);
  }

  @Post(':id/merge')
  @Roles('owner')
  merge(@CurrentTenant() tenant: TenantContext, @CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: MergeCustomerDto) {
    return this.customerService.merge(tenant.id, id, dto, user.id);
  }

  @Delete(':id')
  @Roles('owner')
  @HttpCode(HttpStatus.OK)
  archive(@CurrentTenant() tenant: TenantContext, @CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.customerService.archive(tenant.id, id, user.id);
  }

  @Post(':id/anonymize')
  @Roles('owner')
  anonymize(@CurrentTenant() tenant: TenantContext, @CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.customerService.anonymize(tenant.id, id, user.id);
  }
}
