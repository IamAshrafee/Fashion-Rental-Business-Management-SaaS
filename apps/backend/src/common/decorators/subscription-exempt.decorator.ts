import { SetMetadata } from '@nestjs/common';

export const SUBSCRIPTION_EXEMPT_KEY = 'subscription_exempt';
export const SubscriptionExempt = () => SetMetadata(SUBSCRIPTION_EXEMPT_KEY, true);
