import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ReviewRow {
  bookingItemId: string;
  bookingId: string;
  tenantId: string;
  variantId: string;
  sizeInfo: string | null;
  candidateVariantSizeIds: string[];
  outcome: 'unambiguous' | 'ambiguous' | 'no_match';
}

function readArgument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const apply = process.argv.includes('--apply');
  const tenantId = readArgument('tenant');
  const items = await prisma.bookingItem.findMany({
    where: {
      variantSizeId: null,
      ...(tenantId ? { tenantId } : {}),
    },
    select: {
      id: true,
      bookingId: true,
      tenantId: true,
      variantId: true,
      sizeInfo: true,
    },
    orderBy: [{ tenantId: 'asc' }, { bookingId: 'asc' }, { id: 'asc' }],
  });

  const report: ReviewRow[] = [];
  let updated = 0;
  const variants = await prisma.productVariant.findMany({
    where: {
      id: { in: [...new Set(items.map((item) => item.variantId))] },
      ...(tenantId ? { tenantId } : {}),
    },
    select: {
      id: true,
      tenantId: true,
      sizes: {
        select: {
          id: true,
          sizeInstance: { select: { displayLabel: true, normalizedKey: true } },
        },
      },
    },
  });
  const variantsByTenantAndId = new Map(
    variants.map((variant) => [`${variant.tenantId}:${variant.id}`, variant]),
  );

  for (const item of items) {
    const normalizedLabel = item.sizeInfo?.trim().toLocaleLowerCase() ?? '';
    const allCandidates = variantsByTenantAndId.get(`${item.tenantId}:${item.variantId}`)?.sizes ?? [];
    const labelCandidates = normalizedLabel
      ? allCandidates.filter((candidate) =>
          [candidate.sizeInstance.displayLabel, candidate.sizeInstance.normalizedKey]
            .some((value) => value.trim().toLocaleLowerCase() === normalizedLabel),
        )
      : [];
    const candidates = labelCandidates.length > 0
      ? labelCandidates
      : allCandidates.length === 1
        ? allCandidates
        : [];
    const outcome = candidates.length === 1
      ? 'unambiguous'
      : candidates.length > 1
        ? 'ambiguous'
        : 'no_match';

    report.push({
      bookingItemId: item.id,
      bookingId: item.bookingId,
      tenantId: item.tenantId,
      variantId: item.variantId,
      sizeInfo: item.sizeInfo,
      candidateVariantSizeIds: candidates.map((candidate) => candidate.id),
      outcome,
    });

    if (apply && outcome === 'unambiguous') {
      const result = await prisma.bookingItem.updateMany({
        where: { id: item.id, tenantId: item.tenantId, variantSizeId: null },
        data: { variantSizeId: candidates[0].id },
      });
      updated += result.count;
    }
  }

  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    tenantId: tenantId ?? 'all',
    scanned: report.length,
    unambiguous: report.filter((row) => row.outcome === 'unambiguous').length,
    ambiguous: report.filter((row) => row.outcome === 'ambiguous').length,
    noMatch: report.filter((row) => row.outcome === 'no_match').length,
    updated,
  };

  console.log(JSON.stringify({ summary, review: report.filter((row) => row.outcome !== 'unambiguous') }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
