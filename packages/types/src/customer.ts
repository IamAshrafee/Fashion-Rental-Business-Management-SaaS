export interface Customer {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  totalBookings: number;
  totalSpent: number;
  lastBookingAt: string | null;
  tags: string[];
  city: string | null;
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
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  notes: string | null;
  tags: string[];
  totalBookings: number;
  totalSpent: number;
  lastBookingAt: string | null;
  bookings: CustomerBooking[];
  createdAt: string;
}

export interface CreateCustomerDto {
  fullName: string;
  phone: string;
  altPhone?: string;
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  notes?: string;
}

export interface UpdateCustomerDto {
  fullName?: string;
  altPhone?: string;
  email?: string;
  notes?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface AddCustomerTagDto {
  tag: string;
}
