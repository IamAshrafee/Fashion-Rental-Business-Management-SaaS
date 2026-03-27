import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class CheckSubdomainDto {
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, {
    message: 'Subdomain must be lowercase letters, numbers, and hyphens only',
  })
  subdomain!: string;
}
