import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class RecordPaymentDto {
  @IsInt()
  @Min(1)
  amount!: number; // Paisa

  @IsString()
  @IsNotEmpty()
  method!: string; // 'bkash', 'nagad', 'bank_transfer', 'cash'

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reference?: string; // Transaction ID or receipt number

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  extendMonths?: number; // Auto-extend subscription by N months (default 1)
}
