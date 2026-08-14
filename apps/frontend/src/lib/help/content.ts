import type { ContextHelpContent, ContextHelpKey } from './types';

export const HELP_CONTENT: Record<ContextHelpKey, ContextHelpContent> = {
  'catalog.countryOfOrigin': {
    title: 'Country of origin',
    meaning:
      'The country associated with the product design or manufacture for catalog description.',
    why: 'It helps staff and customers understand the listing; it does not describe where a particular physical item was purchased.',
    example: 'Example: Bangladesh for a locally produced jamdani saree.',
    effect: 'It appears publicly only when the product visibility setting permits it.',
  },
  'catalog.referenceRetailValue': {
    title: 'Reference retail value',
    meaning: 'An optional product-level customer reference or replacement value.',
    why: 'It is merchandising information, separate from the private amount paid for each physical item.',
    example:
      'Example: a designer dress may have a reference value of ৳35,000 while two owned pieces cost ৳18,000 and ৳21,000.',
    effect:
      'It can inform percentage-based deposits or public comparison copy. It never becomes inventory acquisition cost.',
  },
  'catalog.referenceRetailValuePublic': {
    title: 'Show reference value publicly',
    meaning: 'Controls whether customers can see the product-level reference retail value.',
    why: 'Private draft values should not appear on the storefront accidentally.',
    effect:
      'Turning this off preserves the value internally while removing it from public product responses.',
  },
  'catalog.sku': {
    title: 'Rentable SKU',
    meaning: 'The exact product, visual variant, and size that customers can request.',
    example: 'Example: Royal Saree · Red · Free size.',
    effect:
      'Every physical item belongs to one SKU. A SKU stores no editable stock quantity; counts come from its physical items.',
  },
  'catalog.media': {
    title: 'Product and variant images',
    meaning:
      'Product media explains the overall listing; variant media shows the exact color or visual edition.',
    why: 'Configuring media with variants prevents images from being attached to the wrong edition.',
    effect: 'Publication readiness requires the configured customer-facing image coverage.',
  },
  'catalog.featuredImage': {
    title: 'Featured image',
    meaning: 'The primary image used in catalog cards and as the first product-detail image.',
    example: 'Choose the clearest full-product image rather than a close-up detail.',
    effect:
      'Changing it affects presentation only; it does not change variants, SKUs, or inventory.',
  },
  'catalog.altText': {
    title: 'Image alternative text',
    meaning:
      'A concise description for customers who cannot see the image and for cases where it cannot load.',
    example: 'Example: “Red jamdani saree with gold border, front view.”',
    effect: 'Describe what matters; do not repeat “image of” or add internal stock identities.',
  },
  'pricing.rentalRate': {
    title: 'Rental rate',
    meaning: 'The authoritative customer charge produced by the selected rate plan.',
    why: 'Bookings retain their quoted pricing snapshot when future rates change.',
    effect: 'Saving a published pricing change creates new pricing authority for later quotes.',
  },
  'pricing.deposit': {
    title: 'Security deposit',
    meaning:
      'A separately tracked amount held against return obligations; it is not rental revenue.',
    example:
      'A ৳5,000 deposit may be held and later refunded, partially deducted with evidence, or forfeited under policy.',
    effect: 'Deposit settlement remains auditable and cannot exceed the amount held.',
  },
  'pricing.latePolicy': {
    title: 'Late-return policy',
    meaning: 'Defines grace time, late charges, and any cap after the agreed return time.',
    effect: 'Existing bookings keep their policy snapshot; edits affect new authoritative quotes.',
  },
  'inventory.assetCode': {
    title: 'Asset code',
    meaning: 'The permanent tenant-unique internal identity of one exact physical piece.',
    example: 'Example: DRS-RED-M-001.',
    effect:
      'It follows the item through rental, transfer, inspection, cleaning, repair, loss, and retirement.',
  },
  'inventory.barcode': {
    title: 'Barcode',
    meaning: 'An optional scannable identity for one physical item.',
    why: 'It speeds warehouse lookup without replacing the permanent asset code.',
    effect: 'When supplied, it must be unique within the business.',
  },
  'inventory.location': {
    title: 'Current storage location',
    meaning: 'The structured place that physically holds an item now.',
    why: 'Availability, pickup, assignment, and transfer planning depend on it.',
    effect:
      'Change location through a transfer or movement command so custody history remains accurate.',
  },
  'inventory.acquisitionDate': {
    title: 'Acquisition date',
    meaning: 'The date the business obtained this exact physical item.',
    example: 'It can represent purchase, consignment, donation, or owner contribution.',
    effect: 'It belongs to the physical item, never the catalog product.',
  },
  'inventory.acquisitionCost': {
    title: 'Unit acquisition cost',
    meaning: 'The private amount invested in one exact physical item.',
    why: 'Items under the same SKU can have different costs and therefore different recovery results.',
    example:
      'Two identical dresses may cost ৳18,000 and ৳21,000 because they were acquired at different times.',
    effect:
      'It powers cost recovery and profitability; it is never exposed as the public reference retail value.',
  },
  'inventory.acquisitionSource': {
    title: 'Acquisition source',
    meaning: 'Who or where the business obtained the item.',
    example: 'Examples: Aarong, owner contribution, designer consignment, or local tailor.',
  },
  'inventory.acquisitionReference': {
    title: 'Acquisition reference',
    meaning: 'A traceable invoice, purchase order, or consignment agreement identifier.',
    example: 'Example: INV-2026-0412.',
    effect: 'Do not store passwords, card details, or payment credentials.',
  },
  'inventory.condition': {
    title: 'Physical-item condition',
    meaning: 'The last verified condition grade for this exact piece.',
    why: 'Actual condition changes should come from inspection evidence, not casual metadata editing.',
    effect:
      'Condition can affect eligibility, public summaries, service needs, and approved price adjustments.',
  },
  'inventory.currentValue': {
    title: 'Estimated current value',
    meaning: 'An approved internal valuation of the physical item today.',
    why: 'It is separate from historical acquisition cost and product reference value.',
    effect: 'Corrections are audited and do not rewrite revenue or acquisition history.',
  },
  'inventory.components': {
    title: 'Set components',
    meaning: 'The required pieces that make one rentable item complete.',
    example: 'A lehenga set may require a skirt, blouse, and dupatta.',
    effect: 'A missing or damaged required component can block the item from rental.',
  },
  'inventory.operationalState': {
    title: 'Operational state',
    meaning:
      'Where the item currently sits in preparation, rental, return, inspection, cleaning, repair, or transfer.',
    effect:
      'Use the relevant workflow command; direct stock quantity or location edits are not allowed.',
  },
  'inventory.disposition': {
    title: 'Asset disposition',
    meaning:
      'The administrative ownership/availability state: active, quarantined, lost, or retired.',
    effect:
      'Loss and retirement are consequential audited actions; retirement is final while history remains retained.',
  },
  'inventory.transferItems': {
    title: 'Transfer contents',
    meaning: 'The exact physical-item identities moving between locations.',
    example: 'Selecting DRS-001 and DRS-004 creates a two-item transfer.',
    effect: 'Dispatch and receipt outcomes are recorded separately for each selected item.',
  },
  'inventory.blockScope': {
    title: 'Availability block scope',
    meaning:
      'The exact product, variant, SKU, physical item, or location prevented from being offered.',
    effect:
      'Choose the narrowest correct scope. Generic controls cannot delete service- or inspection-owned blocks.',
  },
  'inventory.blockDates': {
    title: 'Blocked dates',
    meaning:
      'The effective date range during which matching physical items cannot supply rental capacity.',
    why: 'This may differ from customer-visible rental dates because preparation, delivery, return, and inspection buffers also matter.',
  },
  'inventory.inspection': {
    title: 'Physical-item inspection',
    meaning:
      'Recorded evidence of condition, component completeness, issues, and the next availability decision.',
    effect:
      'Returned items remain unavailable until their required inspection and follow-up work permit availability.',
  },
  'inventory.service': {
    title: 'Service work',
    meaning:
      'Cleaning, washing, repair, alteration, maintenance, or preparation performed on an exact item.',
    effect:
      'Availability-blocking work keeps the item unavailable until a valid completion or cancellation outcome.',
  },
  'inventory.metadataCorrection': {
    title: 'Audited metadata correction',
    meaning: 'A reasoned correction to identity, acquisition, notes, or approved valuation data.',
    why: 'The audit record preserves the previous value, new value, actor, time, and explanation.',
    effect: 'It does not replace transfers, inspections, or lifecycle commands.',
  },
  'inventory.stockCount': {
    title: 'Identity-based stock count',
    meaning:
      'A reconciliation of the exact asset codes or barcodes physically observed at one location.',
    why: 'Rental capacity comes from individual physical pieces, so an anonymous quantity cannot prove which items are present.',
    example:
      'Scan DRS-001, DRS-002, and DRS-004. The result can show DRS-003 as missing and DRS-004 as recorded at another location.',
    effect:
      'Completing the count preserves every scan and creates item-specific investigation records. It does not silently relocate or reactivate items.',
  },
  'inventory.countFindings': {
    title: 'Stock-count findings',
    meaning:
      'Missing means expected but not seen; unexpected means seen but not expected; wrong location means the item is recorded elsewhere.',
    why: 'Duplicate and unknown scans are retained so staff can distinguish scanning mistakes from identity or custody problems.',
    effect:
      'Operational-review findings require the relevant transfer, return, inspection, loss/recovery, or lifecycle command before the item record changes.',
  },
  'fulfillment.reservationQuantity': {
    title: 'Reserved quantity',
    meaning: 'The number of physical pieces a SKU/location must supply for the blocked date range.',
    why: 'Exact item identities may be assigned later during preparation.',
    effect:
      'Reservation demand reduces available capacity once; assignment realizes that demand and does not subtract it again.',
  },
  'fulfillment.assignment': {
    title: 'Physical-item assignment',
    meaning: 'Links an exact eligible item to a booking requirement.',
    example:
      'A quantity of two requires two separate item assignments before preparation can be ready.',
    effect: 'Customers do not see or select internal asset identities.',
  },
  'fulfillment.preparation': {
    title: 'Preparation status',
    meaning: 'Tracks whether assigned items have been checked and made ready for handout.',
    effect:
      'Every required physical item must be assigned before the requirement can be marked ready.',
  },
  'fulfillment.handout': {
    title: 'Hand out exact items',
    meaning: 'Records which assigned physical pieces actually left business custody.',
    effect: 'The auditable event moves those items into the active rental lifecycle.',
  },
  'fulfillment.return': {
    title: 'Receive exact returns',
    meaning: 'Records which handed-out pieces came back.',
    effect:
      'Returned items move to awaiting inspection rather than immediately becoming available.',
  },
  'fulfillment.loss': {
    title: 'Record a lost item',
    meaning: 'Resolves a handed-out physical identity as lost with an operational reason.',
    effect: 'Loss affects disposition, availability, financial follow-up, and retained history.',
  },
  'analytics.attributedRevenue': {
    title: 'Attributed rental revenue',
    meaning: 'Earned rental revenue allocated to the physical items that were actually handed out.',
    why: 'Stable item-level allocations make SKU and product recovery totals rebuildable from source records.',
    effect:
      'Refunds or later corrections append signed adjustments; original allocations are not rewritten.',
  },
  'analytics.costRecovery': {
    title: 'Acquisition cost recovery',
    meaning: 'Net attributed contribution divided by recorded physical-item acquisition cost.',
    why: 'This replaces an arbitrary target number of rentals with money-based evidence.',
    effect:
      'Completed service cost reduces net contribution. Recovery can exceed 100% without changing the acquisition record.',
  },
  'analytics.incompleteCost': {
    title: 'Incomplete cost data',
    meaning:
      'At least one relevant physical item is missing an acquisition cost or the product has no physical items.',
    effect:
      'The system reports recovery as incomplete instead of treating missing cost as zero and showing false success.',
  },
};
