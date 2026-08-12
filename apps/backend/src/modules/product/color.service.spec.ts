import { ColorService } from './color.service';

describe('ColorService', () => {
  it('lists the explicitly seeded system palette without mutating it', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new ColorService({ color: { findMany } } as never);

    await expect(service.listColors()).resolves.toEqual([]);
    expect(findMany).toHaveBeenCalledWith({
      where: { isSystem: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, hexCode: true, isSystem: true },
    });
  });
});
