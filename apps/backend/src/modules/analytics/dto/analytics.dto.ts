import { IsOptional, IsString, IsDateString, IsIn } from 'class-validator';

export class AnalyticsQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  productId?: string;
}

export class RevenueChartQueryDto extends AnalyticsQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(['day', 'week', 'month'])
  groupBy?: 'day' | 'week' | 'month';
}

export class TopProductsQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(['bookings', 'revenue'])
  sortBy?: 'bookings' | 'revenue';

  @IsOptional()
  limit?: number;
}

export const ANALYTICS_EXPORT_TYPES = [
  'bookings',
  'customers',
  'inventory',
  'payments',
  'recovery',
] as const;
export type AnalyticsExportType = (typeof ANALYTICS_EXPORT_TYPES)[number];

export class AnalyticsExportParamDto {
  @IsIn(ANALYTICS_EXPORT_TYPES)
  type!: AnalyticsExportType;
}
