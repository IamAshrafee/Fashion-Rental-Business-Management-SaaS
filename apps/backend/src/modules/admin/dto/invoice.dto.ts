import { IsDateString, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class InvoiceLineItemDto {
  @IsString()
  description!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsInt()
  @Min(0)
  rate!: number; // Paisa

  @IsInt()
  @Min(0)
  amount!: number; // Paisa
}

export class CreateInvoiceDto {
  @IsInt()
  @Min(0)
  amount!: number; // Paisa — total amount

  @IsDateString()
  dueDate!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineItemDto)
  lineItems!: InvoiceLineItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateInvoiceStatusDto {
  @IsString()
  status!: string; // 'paid', 'void'

  @IsOptional()
  @IsString()
  paymentId?: string; // Link to a SubscriptionPayment if paid
}
