import { ColorService } from './color.service';

describe('ColorService', () => {
  it('seeds one canonical, database-addressable system palette', async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const service = new ColorService({ color: { upsert } } as never);

    await expect(service.seedSystemColors()).resolves.toBe(41);
    expect(upsert).toHaveBeenCalledTimes(41);

    const keys = upsert.mock.calls.map(([request]) => request.where.systemKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { systemKey: 'system:red' },
      update: expect.objectContaining({ name: 'Red', hexCode: '#EF4444' }),
      create: expect.objectContaining({
        systemKey: 'system:red',
        name: 'Red',
        tenantId: null,
        isSystem: true,
      }),
    }));
  });
});
