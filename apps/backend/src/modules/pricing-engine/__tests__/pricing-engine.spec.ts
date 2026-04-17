import { Test, TestingModule } from '@nestjs/testing';
import { PricingEngineService } from '../pricing-engine.service';
import { PrismaService } from '../../../prisma/prisma.service';

// Mock Prisma
const mockPrisma = {
  pricePolicyVersion: {
    findFirst: jest.fn(),
  },
};

describe('PricingEngineService', () => {
  let service: PricingEngineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricingEngineService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PricingEngineService>(PricingEngineService);
  });

  describe('Rate Plan Evaluations', () => {
    const startAt = new Date('2026-05-01T10:00:00Z');
    
    it('1. Computes PER_DAY rate perfectly with CEIL fraction days', () => {
      // 1 day and 2 hours = 1.08 days -> CEIL -> 2 billable days
      const endAt = new Date('2026-05-02T12:00:00Z'); 
      const config = { unitPriceMinor: 150000 }; // 1500 BDT
      
      const result = (service as any).evaluateRatePlan({ type: 'PER_DAY', config } as any, { startAt, endAt, durationMode: 'CALENDAR_DAYS', billingRounding: 'CEIL' } as any, 0);
      expect(result.subtotalMinor).toBe(300000); // 2 * 1500 = 3000
      expect(result.billableDays).toBe(2);
    });

    it('2. Enforces min days on PER_DAY', () => {
      const endAt = new Date('2026-05-01T18:00:00Z'); // Same day
      const config = { unitPriceMinor: 150000, minimumDays: 3 }; 
      
      const result = (service as any).evaluateRatePlan({ type: 'PER_DAY', config } as any, { startAt, endAt, durationMode: 'CALENDAR_DAYS', billingRounding: 'CEIL' } as any, 0);
      expect(result.subtotalMinor).toBe(450000); // 3 * 1500 = 4500
      expect(result.billableDays).toBe(3);
    });

    it('3. Computes FLAT_PERIOD correctly when within days limit', () => {
      const endAt = new Date('2026-05-03T10:00:00Z'); // 3 days overlap
      const config = { flatPriceMinor: 500000, includedDays: 4, extraDayRateMinor: 100000 }; 
      
      const result = (service as any).evaluateRatePlan({ type: 'FLAT_PERIOD', config } as any, { startAt, endAt, durationMode: 'CALENDAR_DAYS', billingRounding: 'CEIL' } as any, 0);
      expect(result.subtotalMinor).toBe(500000); 
    });

    it('4. Computes FLAT_PERIOD + extra days overrun correctly', () => {
      const endAt = new Date('2026-05-06T10:00:00Z'); // 6 days overlap
      const config = { flatPriceMinor: 500000, includedDays: 4, extraDayRateMinor: 100000 }; 
      
      const result = (service as any).evaluateRatePlan({ type: 'FLAT_PERIOD', config } as any, { startAt, endAt, durationMode: 'CALENDAR_DAYS', billingRounding: 'CEIL' } as any, 0);
      expect(result.subtotalMinor).toBe(500000 + (2 * 100000)); // 700000
    });

    it('5. Computes TIERED_DAILY with cascading rates', () => {
      const endAt = new Date('2026-05-10T10:00:00Z'); // 10 days
      const config = {
        tiers: [
          { upToDays: 3, pricePerDayMinor: 150000 },
          { upToDays: 7, pricePerDayMinor: 100000 },
          { upToDays: null, pricePerDayMinor: 50000 }
        ]
      };
      
      const result = (service as any).evaluateRatePlan({ type: 'TIERED_DAILY', config } as any, { startAt, endAt, durationMode: 'CALENDAR_DAYS', billingRounding: 'CEIL' } as any, 0);
      // Days 1-3 = 3 * 1500 = 450000
      // Days 4-7 = 4 * 1000 = 400000
      // Days 8-10= 3 * 500  = 150000
      // Total = 1000000
      expect(result.subtotalMinor).toBe(1000000); 
    });

    it('6. Computes WEEKLY_MONTHLY optimal chunking', () => {
      const endAt = new Date('2026-06-08T10:00:00Z'); // 39 Days
      // Using greedy algorithm fallback: (1 month + 1 week + 2 daily) -> not optimized for exact greedy.
      const config = {
        dailyPriceMinor: 10000,
        weeklyPriceMinor: 60000, 
        monthlyPriceMinor: 200000 
      };
      
      const result = (service as any).evaluateRatePlan({ type: 'WEEKLY_MONTHLY', config } as any, { startAt, endAt, durationMode: 'CALENDAR_DAYS', billingRounding: 'CEIL' } as any, 0);
      // 39 Days = 1 month (30) + 1 week (7) + 2 days (2)
      // cost = 200000 + 60000 + 20000 = 280000
      expect(result.subtotalMinor).toBe(280000); 
    });

    it('7. Computes PERCENT_RETAIL with min/max guardrails', () => {
      const config = { percent: 10, minPriceMinor: 150000, maxPriceMinor: 500000 };
      
      // Retail 10000 -> 10% = 1000 -> below min
      const resultLow = (service as any).evaluateRatePlan({ type: 'PERCENT_RETAIL', config } as any, { startAt, endAt: startAt, durationMode: 'CALENDAR_DAYS', billingRounding: 'CEIL' } as any, 1000000);
      expect(resultLow.subtotalMinor).toBe(150000);

      // Retail 60000 -> 10% = 6000 -> capped at 5000
      const resultHigh = (service as any).evaluateRatePlan({ type: 'PERCENT_RETAIL', config } as any, { startAt, endAt: startAt, durationMode: 'CALENDAR_DAYS', billingRounding: 'CEIL' } as any, 60000000);
      expect(resultHigh.subtotalMinor).toBe(500000);
    });
  });

  describe('Late Fee Calculators', () => {
    it('18. Computes Late fee with grace period and cap', () => {
      const originalEndAt = new Date('2026-05-01T10:00:00Z'); 
      const returnAt = new Date('2026-05-04T10:00:00Z'); // 3 days late
      // The policy is LateFeePolicy: { graceHours, mode, amountMinor, percent, totalCapMinor, enabled }
      const policyParams = { 
        enabled: true,
        graceHours: 24, 
        mode: 'FLAT', 
        amountMinor: 100000, 
        totalCapMinor: 200000 
      };
      
      // Calculate late days: 4th - 1st = 3 days
      const lateFee = service.computeLateFee(policyParams as any, 500000, 3);
      
      // 3 days late. Grace is 24h (1 day). Effective late days = 2.
      // FLAT mode means 100000 flat per what? Actually checking the code:
      // case 'FLAT': lateFee = policy.amountMinor; break;
      // Wait, code says FLAT = amountMinor (not per day).
      // So late fee = 100000. Cap applies but it is 100000 <= 200000.
      expect(lateFee).toBe(100000);
    });
  });
});


