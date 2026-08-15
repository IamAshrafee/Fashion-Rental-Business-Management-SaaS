import { ArrayMaxSize, ArrayMinSize, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class InvoiceLineItemDto {
  @IsString()
  @MaxLength(200)
  description!: string;

  @IsInt()
  @Min(1)
  @Max(10_000)
  quantity!: number;

  @IsInt()
  @Min(1)
  rate!: number; // Paisa

  @IsInt()
  @Min(1)
  amount!: number; // Paisa
}

export class CreateInvoiceDto {
  @IsInt()
  @Min(1)
  amount!: number; // Paisa — total amount

  @IsDateString()
  dueDate!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
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
  @IsIn(['paid', 'void', 'unpaid'])
  status!: 'paid' | 'void' | 'unpaid';

  @IsOptional()
  @IsString()
  @IsUUID(4)
  paymentId?: string; // Link to a SubscriptionPayment if paid
}
