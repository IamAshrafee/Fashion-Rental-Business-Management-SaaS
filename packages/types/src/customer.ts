export interface Customer {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  totalBookings: number;
  totalSpent: number;
  lastBookingAt: string | null;
  tags: string[];
  district: string | null;
}

export interface CustomerBooking {
  id: string;
  bookingNumber: string;
  status: string;
  grandTotal: number;
  createdAt: string;
  items: Array<{
    productName: string;
    colorName?: string | null;
  }>;
}

export interface CustomerDetail {
  id: string;
  fullName: string;
  phone: string;
  altPhone: string | null;
  email: string | null;
  address: string | null;
  area: string | null;
  district: string | null;
  notes: string | null;
  tags: string[];
  totalBookings: number;
  totalSpent: number;
  bookings: CustomerBooking[];
}

export interface UpdateCustomerDto {
  fullName?: string;
  altPhone?: string;
  email?: string;
  notes?: string;
}

export interface AddCustomerTagDto {
  tag: string;
}
