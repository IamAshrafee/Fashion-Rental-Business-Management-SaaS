import { buildBookingOperations } from './booking-operations';

const base = {
  status: 'confirmed' as const,
  grandTotal: 0,
  totalPaid: 0,
  sourceLocation: null,
  handoverMethod: 'DELIVERY' as const,
  returnMethod: 'BUSINESS_PICKUP' as const,
};

const requirement = (sourceLocation?: { id: string; code: string; name: string }) => ({
  status: 'ASSIGNED',
  sourceLocationId: sourceLocation?.id ?? null,
  sourceLocation: sourceLocation ?? null,
  quantity: 1,
  assignedQuantity: 1,
  handedOutQuantity: 0,
  returnedQuantity: 0,
  lostQuantity: 0,
  preparationStatus: 'NOT_STARTED',
});

describe('buildBookingOperations fulfillment location summary', () => {
  it('uses the requirement location for a storefront booking with no booking-level location', () => {
    const operations = buildBookingOperations({
      ...base,
      items: [{
        quantity: 1,
        startDate: new Date('2026-08-18'),
        endDate: new Date('2026-08-20'),
        depositAmount: 0,
        depositSettlement: null,
        stockUnitInspections: [],
        stockUnitIssues: [],
        fulfillmentRequirements: [requirement({ id: 'location-1', code: 'MAIN', name: 'Main showroom' })],
      }],
    });

    expect(operations.fulfillmentLocations).toEqual({
      state: 'SINGLE',
      locations: [{ id: 'location-1', code: 'MAIN', name: 'Main showroom' }],
    });
    expect(operations.sourceLocation).toMatchObject({ id: 'location-1' });
  });

  it('reports multiple locations rather than pretending one location owns the booking', () => {
    const operations = buildBookingOperations({
      ...base,
      items: [{
        quantity: 2,
        startDate: new Date('2026-08-18'),
        endDate: new Date('2026-08-20'),
        depositAmount: 0,
        depositSettlement: null,
        stockUnitInspections: [],
        stockUnitIssues: [],
        fulfillmentRequirements: [
          requirement({ id: 'location-2', code: 'DHK', name: 'Dhaka studio' }),
          requirement({ id: 'location-1', code: 'MAIN', name: 'Main showroom' }),
        ],
      }],
    });

    expect(operations.fulfillmentLocations).toMatchObject({
      state: 'MULTIPLE',
      locations: [
        { id: 'location-2', code: 'DHK', name: 'Dhaka studio' },
        { id: 'location-1', code: 'MAIN', name: 'Main showroom' },
      ],
    });
  });
});
