import { IsOptional, IsString, IsDateString, IsIn } from 'class-validator';

export class AnalyticsQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
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
