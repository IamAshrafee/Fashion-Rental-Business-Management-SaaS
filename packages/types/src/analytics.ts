export interface RevenueSummary {
  total: number;
  previousPeriod: number;
  growthPercentage: number;
  averageOrderValue: number;
}

export interface BookingsSummary {
  total: number;
  completed: number;
  active: number;
  cancelled: number;
  cancellationRate: number;
}

export interface CustomersSummary {
  total: number;
  new: number;
  returning: number;
  retentionRate: number;
}

export interface ProductsSummary {
  totalActive: number;
  idle: number;
  averageUtilization: number;
}

export interface AnalyticsSummary {
  revenue: RevenueSummary;
  bookings: BookingsSummary;
  customers: CustomersSummary;
  products: ProductsSummary;
}

export interface RevenueSeriesPoint {
  date: string;
  revenue: number;
}

export interface RevenueSeries {
  series: RevenueSeriesPoint[];
  total: number;
}

export interface CategoryRevenue {
  category: string;
  revenue: number;
  percentage: number;
}

export interface TopProduct {
  productId: string;
  name: string;
  totalBookings: number;
  totalRevenue: number;
  utilizationRate: number;
  thumbnailUrl: string | null;
}

export interface TargetRecoveryProduct {
  productId: string;
  name: string;
  purchasePrice: number;
  recovered: number;
  recoveryPercentage: number;
  status: 'exceeded' | 'recovering' | 'idle';
}

export interface TargetRecoverySummary {
  totalInvestment: number;
  totalRecovered: number;
  overallRecoveryPercentage: number;
  productsAtTarget: number;
  productsBelowTarget: number;
  products: TargetRecoveryProduct[];
}
