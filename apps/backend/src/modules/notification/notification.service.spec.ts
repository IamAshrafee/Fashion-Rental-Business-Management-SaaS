import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  const notification = {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  };

  const service = new NotificationService({ notification } as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists only tenant-wide and current-user notifications', async () => {
    notification.findMany.mockResolvedValue([{ id: 'notification-1' }]);
    notification.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);

    await service.list('tenant-1', 'user-1', { page: 1, limit: 20 });

    const visibleWhere = {
      tenantId: 'tenant-1',
      OR: [{ userId: null }, { userId: 'user-1' }],
    };
    expect(notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: visibleWhere }),
    );
    expect(notification.count).toHaveBeenNthCalledWith(1, { where: visibleWhere });
    expect(notification.count).toHaveBeenNthCalledWith(2, {
      where: { ...visibleWhere, isRead: false },
    });
  });

  it('marks all read only within the current user visibility scope', async () => {
    notification.updateMany.mockResolvedValue({ count: 2 });

    await expect(service.markAllRead('tenant-1', 'user-1')).resolves.toEqual({
      markedCount: 2,
    });
    expect(notification.updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        OR: [{ userId: null }, { userId: 'user-1' }],
        isRead: false,
      },
      data: { isRead: true, readAt: expect.any(Date) },
    });
  });

  it('does not expose a notification addressed to another user', async () => {
    notification.findFirst.mockResolvedValue(null);

    await expect(service.markRead('tenant-1', 'user-1', 'notification-2')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(notification.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'notification-2',
        tenantId: 'tenant-1',
        OR: [{ userId: null }, { userId: 'user-1' }],
      },
    });
    expect(notification.update).not.toHaveBeenCalled();
  });
});
