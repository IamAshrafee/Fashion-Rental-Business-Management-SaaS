import { FulfillmentService } from './fulfillment.service';

function service() {
  return new FulfillmentService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { emit: jest.fn() } as never,
  );
}

describe('FulfillmentService confirmation safeguards', () => {
  const requirement = {
    id: 'requirement-1',
    variantSizeId: 'sku-1',
    status: 'RESERVED',
    quantity: 2,
  };

  it('rejects confirmation when the SKU reservation lacks exact physical-item assignments', async () => {
    const tx = {
      fulfillmentRequirement: { findMany: jest.fn().mockResolvedValue([requirement]) },
      stockUnitAssignment: { findMany: jest.fn().mockResolvedValue([{ reservation: { fulfillmentRequirementId: 'requirement-1' } }]) },
    };

    await expect(
      service().assertAndTransitionBooking(tx as never, 'tenant-1', 'booking-1', 'confirmed'),
    ).rejects.toThrow('Assign every exact physical item before confirming this rental');
  });

  it('allows confirmation when every required physical item is actively assigned', async () => {
    const tx = {
      fulfillmentRequirement: { findMany: jest.fn().mockResolvedValue([requirement]) },
      stockUnitAssignment: {
        findMany: jest.fn().mockResolvedValue([
          { reservation: { fulfillmentRequirementId: 'requirement-1' } },
          { reservation: { fulfillmentRequirementId: 'requirement-1' } },
        ]),
      },
    };

    await expect(
      service().assertAndTransitionBooking(tx as never, 'tenant-1', 'booking-1', 'confirmed'),
    ).resolves.toBeUndefined();
  });
});
