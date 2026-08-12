import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, StorefrontCartStatus } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CartItemDto, StorefrontCartLineDto } from './dto/booking.dto';

const CART_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class StorefrontCartService {
  static readonly cookieName = 'closetrent_cart';

  constructor(private readonly prisma: PrismaService) {}

  private tokenHash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private expiresAt() {
    return new Date(Date.now() + CART_LIFETIME_MS);
  }

  private async findActive(tenantId: string, token?: string) {
    if (!token || token.length < 32) return null;
    const cart = await this.prisma.storefrontCart.findFirst({
      where: { tenantId, tokenHash: this.tokenHash(token) },
      include: { lines: { orderBy: { createdAt: 'asc' } } },
    });
    if (!cart || cart.status !== StorefrontCartStatus.ACTIVE) return null;
    if (cart.expiresAt <= new Date()) {
      await this.prisma.storefrontCart.update({
        where: { id: cart.id },
        data: { status: StorefrontCartStatus.EXPIRED },
      });
      return null;
    }
    return cart;
  }

  async get(tenantId: string, token?: string) {
    const cart = await this.findActive(tenantId, token);
    return cart ? this.project(cart) : { id: null, items: [], expiresAt: null };
  }

  async replace(tenantId: string, token: string | undefined, items: StorefrontCartLineDto[]) {
    await this.assertCatalogReferences(tenantId, items);
    let cart = await this.findActive(tenantId, token);
    let issuedToken: string | undefined;
    if (!cart) {
      issuedToken = randomBytes(32).toString('base64url');
      cart = await this.prisma.storefrontCart.create({
        data: { tenantId, tokenHash: this.tokenHash(issuedToken), expiresAt: this.expiresAt() },
        include: { lines: true },
      });
    }

    const expiresAt = this.expiresAt();
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.storefrontCartLine.deleteMany({ where: { cartId: cart!.id } });
      if (items.length) {
        await tx.storefrontCartLine.createMany({
          data: items.map((item) => ({
            cartId: cart!.id,
            lineKey: item.lineKey,
            productId: item.productId,
            variantId: item.variantId,
            variantSizeId: item.variantSizeId,
            quantity: item.quantity,
            startDate: new Date(item.startDate),
            endDate: new Date(item.endDate),
            selectedSize: item.selectedSize,
            configuration: {
              backupSize: item.backupSize ?? null,
              tryOn: item.tryOn ?? false,
              compositionSelections: item.compositionSelections ?? [],
            } as unknown as Prisma.InputJsonValue,
            displaySnapshot: (item.displaySnapshot ?? {}) as Prisma.InputJsonValue,
          })),
        });
      }
      return tx.storefrontCart.update({
        where: { id: cart!.id },
        data: { lastActivityAt: new Date(), expiresAt },
        include: { lines: { orderBy: { createdAt: 'asc' } } },
      });
    });
    return { cart: this.project(updated), issuedToken };
  }

  async requireMatching(tenantId: string, token: string | undefined, items: CartItemDto[]) {
    const cart = await this.findActive(tenantId, token);
    if (!cart) throw new BadRequestException('Your cart session expired; refresh the cart and try again');
    const stored = cart.lines.map((line) => this.toBookingItem(line));
    if (this.itemsHash(stored) !== this.itemsHash(items)) {
      throw new BadRequestException('The server cart changed; refresh checkout before continuing');
    }
    return cart;
  }

  async requireIdentity(tenantId: string, token?: string) {
    if (!token || token.length < 32) throw new BadRequestException('Your cart session expired; refresh the cart and try again');
    const cart = await this.prisma.storefrontCart.findFirst({
      where: { tenantId, tokenHash: this.tokenHash(token) },
      select: { id: true },
    });
    if (!cart) throw new BadRequestException('Your cart session expired; refresh the cart and try again');
    return cart;
  }

  toBookingItems(lines: Array<Parameters<StorefrontCartService['toBookingItem']>[0]>) {
    return lines.map((line) => this.toBookingItem(line));
  }

  itemsHash(items: CartItemDto[]) {
    return this.canonicalHash(items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      variantSizeId: item.variantSizeId,
      quantity: item.quantity ?? 1,
      startDate: item.startDate,
      endDate: item.endDate,
      selectedSize: item.selectedSize ?? null,
      backupSize: item.backupSize ?? null,
      tryOn: item.tryOn === true,
      compositionSelections: item.compositionSelections ?? [],
    })));
  }

  private toBookingItem(line: {
    productId: string; variantId: string; variantSizeId: string;
    quantity: number; startDate: Date; endDate: Date; selectedSize: string | null; configuration: Prisma.JsonValue;
  }): CartItemDto {
    const configuration = (line.configuration && typeof line.configuration === 'object' && !Array.isArray(line.configuration))
      ? line.configuration as Record<string, unknown>
      : {};
    return {
      productId: line.productId,
      variantId: line.variantId,
      variantSizeId: line.variantSizeId,
      quantity: line.quantity,
      startDate: line.startDate.toISOString().slice(0, 10),
      endDate: line.endDate.toISOString().slice(0, 10),
      ...(line.selectedSize ? { selectedSize: line.selectedSize } : {}),
      ...(typeof configuration.backupSize === 'string' ? { backupSize: configuration.backupSize } : {}),
      ...(typeof configuration.tryOn === 'boolean' ? { tryOn: configuration.tryOn } : {}),
      ...(Array.isArray(configuration.compositionSelections) && configuration.compositionSelections.length
        ? { compositionSelections: configuration.compositionSelections as CartItemDto['compositionSelections'] }
        : {}),
    };
  }

  private project(cart: { id: string; expiresAt: Date; lines: Array<{
    lineKey: string; productId: string; variantId: string; variantSizeId: string;
    quantity: number; startDate: Date; endDate: Date; selectedSize: string | null; configuration: Prisma.JsonValue; displaySnapshot: Prisma.JsonValue;
  }> }) {
    return {
      id: cart.id,
      expiresAt: cart.expiresAt.toISOString(),
      items: cart.lines.map((line) => ({
        lineKey: line.lineKey,
        ...this.toBookingItem(line),
        displaySnapshot: line.displaySnapshot,
      })),
    };
  }

  private canonicalHash(value: unknown) {
    const normalize = (entry: unknown): unknown => {
      if (Array.isArray(entry)) return entry.map(normalize);
      if (entry && typeof entry === 'object') {
        return Object.fromEntries(Object.entries(entry as Record<string, unknown>)
          .filter(([, child]) => child !== undefined)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, child]) => [key, normalize(child)]));
      }
      return entry;
    };
    return createHash('sha256').update(JSON.stringify(normalize(value))).digest('hex');
  }

  private async assertCatalogReferences(tenantId: string, items: StorefrontCartLineDto[]) {
    if (!items.length) return;
    const sizeIds = [...new Set(items.map((item) => item.variantSizeId))];
    const records = await this.prisma.variantSize.findMany({
      where: { tenantId, id: { in: sizeIds } },
      select: { id: true, variantId: true, variant: { select: { productId: true } } },
    });
    const byId = new Map(records.map((record) => [record.id, record]));
    for (const item of items) {
      const record = byId.get(item.variantSizeId);
      if (!record || record.variantId !== item.variantId || record.variant.productId !== item.productId) {
        throw new BadRequestException('A cart item no longer belongs to this store or product');
      }
      if (item.endDate < item.startDate) throw new BadRequestException('Rental end date must be on or after the start date');
    }
  }
}
