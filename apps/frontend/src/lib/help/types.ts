export interface ContextHelpContent {
  title: string;
  meaning: string;
  why?: string;
  example?: string;
  effect?: string;
  relatedLink?: { label: string; href: string };
}

export type ContextHelpKey =
  | 'catalog.countryOfOrigin'
  | 'catalog.referenceRetailValue'
  | 'catalog.referenceRetailValuePublic'
  | 'catalog.sku'
  | 'catalog.media'
  | 'catalog.featuredImage'
  | 'catalog.altText'
  | 'pricing.rentalRate'
  | 'pricing.deposit'
  | 'pricing.latePolicy'
  | 'inventory.assetCode'
  | 'inventory.barcode'
  | 'inventory.location'
  | 'inventory.acquisitionDate'
  | 'inventory.acquisitionCost'
  | 'inventory.acquisitionSource'
  | 'inventory.acquisitionReference'
  | 'inventory.condition'
  | 'inventory.currentValue'
  | 'inventory.components'
  | 'inventory.operationalState'
  | 'inventory.disposition'
  | 'inventory.transferItems'
  | 'inventory.blockScope'
  | 'inventory.blockDates'
  | 'inventory.inspection'
  | 'inventory.service'
  | 'inventory.metadataCorrection'
  | 'inventory.stockCount'
  | 'inventory.countFindings'
  | 'fulfillment.reservationQuantity'
  | 'fulfillment.assignment'
  | 'fulfillment.preparation'
  | 'fulfillment.handout'
  | 'fulfillment.return'
  | 'fulfillment.loss'
  | 'analytics.attributedRevenue'
  | 'analytics.costRecovery'
  | 'analytics.incompleteCost';
