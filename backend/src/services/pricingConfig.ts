import { env } from '../config/env';
import { PricingConfig } from './rules/pricing';

export const pricingConfig: PricingConfig = {
  taxRatePercent: env.TAX_RATE_PERCENT,
  platformFeePaise: Math.round(env.PLATFORM_FEE * 100),
};
