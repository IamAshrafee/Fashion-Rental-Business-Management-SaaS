import type { ContextHelpContent, ContextHelpKey } from './types';

export const HELP_CONTENT: Record<ContextHelpKey, ContextHelpContent> = {
  'catalog.productName': {
    title: 'Customer-facing product name',
    meaning: 'The stable catalog name customers and staff use to recognize this rental style.',
    why: 'A product describes a style; color and size belong to its variants and SKUs, while exact asset identities belong in Inventory.',
    example: 'Example: “Royal Banarasi Saree” here, “Ivory Gold” as the variant, and SAREE-014 as a physical item asset code.',
    effect: 'Changing the name also updates the storefront URL slug, but it does not change existing booking or inventory history.',
  },
  'catalog.description': {
    title: 'Product description',
    meaning: 'Customer-facing guidance about the style, material, fit, occasion, and included presentation.',
    why: 'It helps a renter decide whether the style suits the event without exposing private purchasing or asset data.',
    example: 'Example: mention silk, embroidery, drape, matching pieces, and styling advice. Record stains or repairs on the exact physical item instead.',
    effect: 'The description appears on the storefront after publication and can be changed without rewriting prior bookings.',
  },
  'catalog.category': {
    title: 'Product category',
    meaning: 'The main storefront and reporting group for this rental style.',
    why: 'Categories drive navigation and filtering; they do not define inventory quantity or physical-item identity.',
    example: 'Examples: Sarees, Lehengas, Dresses, Sherwanis, Accessories.',
    effect: 'Changing it moves the listing to a different storefront group. Any selected subcategory must belong to the new category.',
  },
  'catalog.subcategory': {
    title: 'Optional subcategory',
    meaning: 'A narrower classification inside the selected main category.',
    example: 'Example: “Banarasi” inside “Sarees”, or “Tuxedo” inside “Suits”.',
    effect: 'Choose “No subcategory” when the broader category is sufficient. Changing the category clears an incompatible subcategory.',
  },
  'catalog.events': {
    title: 'Suitable events',
    meaning: 'Occasions for which customers may discover this product through filters and collections.',
    why: 'These are merchandising associations, not booking restrictions.',
    example: 'A formal lehenga may be associated with Wedding, Reception, and Engagement.',
    effect: 'Selecting or clearing events changes discovery only; availability still comes from eligible physical items and dates.',
  },
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
  'catalog.productType': {
    title: 'Product type and default sizing',
    meaning: 'The operational type that supplies the product’s default size schema.',
    why: 'Every rentable SKU must use a size instance from the product’s active schema.',
    example: 'Example: “Women’s Dress” may default to UK 6–18, while “Saree” may use Free Size.',
    effect: 'Changing type is blocked when existing SKUs would no longer belong to the resolved schema.',
    relatedLink: { label: 'Manage product types', href: '/dashboard/products/product-types' },
  },
  'catalog.sizeSchemaOverride': {
    title: 'Size-schema override',
    meaning: 'An exception that makes this product use a different active size system from its product type default.',
    why: 'Use it only when this style genuinely follows another sizing system; routine differences belong in measurements or fit details.',
    example: 'A specific imported dress may use EU sizes even though the product type normally uses UK sizes.',
    effect: 'Removing the override returns to the type default. A change is rejected if current SKUs are outside the resulting schema.',
    relatedLink: { label: 'Manage sizing schemas', href: '/dashboard/products/sizing-schemas' },
  },
  'catalog.variantName': {
    title: 'Variant name',
    meaning: 'An optional customer-friendly name for one visual edition of the product.',
    example: 'Examples: “Ivory Gold”, “Midnight Blue”, or “Floral Edition”. Leave it blank when the main color name is enough.',
    effect: 'It labels the variant; it does not identify a physical item or create stock.',
  },
  'catalog.mainColor': {
    title: 'Main variant color',
    meaning: 'The dominant color used for the variant’s primary swatch and identity.',
    why: 'A product can have several visual variants, each with its own media and rentable size SKUs.',
    example: 'For a red-and-gold saree whose dominant appearance is red, choose Red as the main color and Gold as an identical/search color.',
    effect: 'Changing it updates variant presentation and search matching, not physical-item condition or location.',
  },
  'catalog.identicalColors': {
    title: 'Additional visible colors',
    meaning: 'Other colors visibly present in the same variant for accurate storefront filtering.',
    why: 'This prevents customers from missing a multicolor style when filtering by a secondary color.',
    example: 'An ivory dress with gold embroidery can match both Ivory and Gold while retaining Ivory as its main color.',
    effect: 'These values affect discovery only; they do not create separate variants or inventory.',
  },
  'catalog.details': {
    title: 'Structured product details',
    meaning: 'Customer-facing groups of reusable facts, stored as a section name with key–value rows.',
    example: 'Section “Materials & Care”: Fabric = Pure silk; Embellishment = Hand embroidery; Care = Dry clean only.',
    effect: 'The ordered sections appear on the product page. Physical-item-specific defects and service notes belong in Inventory.',
  },
  'catalog.faq': {
    title: 'Product-specific FAQ',
    meaning: 'A question and answer that applies to this rental style rather than the whole store.',
    example: 'Question: “Is a matching blouse included?” Answer: “Yes, the listed set includes the blouse shown in the photos.”',
    effect: 'FAQs reduce customer uncertainty but do not override booking terms, pricing, deposits, or availability rules.',
  },
  'pricing.rentalRate': {
    title: 'Rental rate',
    meaning: 'The authoritative customer charge produced by the selected rate plan.',
    why: 'Bookings retain their quoted pricing snapshot when future rates change.',
    effect: 'Saving a published pricing change creates new pricing authority for later quotes.',
  },
  'pricing.model': {
    title: 'Rental pricing model',
    meaning: 'The rule the quote engine uses to calculate the base rental charge from the booking dates.',
    why: 'A single authoritative model prevents the storefront, checkout, manual booking, and reporting totals from disagreeing.',
    example: 'Use Per Day for a daily rate, Flat Period for a three-day package, or Tiered Daily when later days become cheaper.',
    effect: 'Changing the model publishes a new pricing version for future quotes. Existing bookings retain their saved pricing snapshot.',
  },
  'pricing.duration': {
    title: 'Rental duration rule',
    meaning: 'The minimum, included, or additional billable days defined by the selected pricing model.',
    example: 'A ৳3,000 three-day package with a ৳700 extra-day rate costs ৳3,700 for four billable days before other charges.',
    effect: 'Preparation, delivery, and return buffers affect inventory availability separately; they are not automatically billed rental days.',
  },
  'pricing.tiers': {
    title: 'Tiered daily pricing',
    meaning: 'Ordered, gap-free day ranges that can apply different daily rates as a rental gets longer.',
    why: 'Every billable day must belong to exactly one tier so quotes remain deterministic.',
    example: 'Days 1–3 at ৳1,000/day, days 4–7 at ৳800/day, and day 8 onward at ৳600/day.',
    effect: 'The first tier starts at day 1 and only the final tier may have no ending day.',
  },
  'pricing.longTermRates': {
    title: 'Daily, weekly, and monthly rates',
    meaning: 'Bundle rates the quote engine combines for longer rentals, with a daily fallback for remaining days.',
    example: 'A 10-day rental can use one weekly rate plus three daily-rate days when that is the configured decomposition.',
    effect: 'Enter customer charges, not internal acquisition cost or a manual stock target.',
  },
  'pricing.percentRetail': {
    title: 'Percentage-of-reference pricing',
    meaning: 'Calculates the base rental charge as a percentage of the product’s reference retail value, within optional minimum and maximum limits.',
    why: 'It keeps similar products proportionally priced while preserving each physical item’s private acquisition cost.',
    example: '10% of a ৳40,000 reference value produces ৳4,000 before configured limits, deposits, fees, or add-ons.',
    effect: 'A positive reference retail value is required. Changing the public-visibility switch does not change this calculation.',
  },
  'pricing.deposit': {
    title: 'Security deposit',
    meaning:
      'A separately tracked amount held against return obligations; it is not rental revenue.',
    example:
      'A ৳5,000 deposit may be held and later refunded, partially deducted with evidence, or forfeited under policy.',
    effect: 'Deposit settlement remains auditable and cannot exceed the amount held.',
  },
  'pricing.cleaningFee': {
    title: 'Customer cleaning fee',
    meaning: 'An optional non-refundable service charge added to the customer quote.',
    why: 'It is customer pricing, not the actual internal cost of cleaning a particular returned item.',
    example: 'Charge a flat ৳300 when every rental includes a standard cleaning service.',
    effect: 'Actual service work and cost are recorded against each physical item after return.',
  },
  'pricing.backupSize': {
    title: 'Backup-size add-on',
    meaning: 'An optional customer charge for requesting an additional size as part of fulfillment.',
    why: 'The fee alone does not promise capacity; the booking still needs an eligible physical item for every required SKU.',
    example: 'A customer rents size M and adds size L as a backup for ৳500.',
    effect: 'Selection becomes a priced fulfillment requirement and consumes real serialized inventory capacity.',
  },
  'pricing.tryOn': {
    title: 'Try-on service add-on',
    meaning: 'An optional charge for a configured try-on service associated with the rental.',
    example: 'A store may charge ৳400 for an appointment or pre-rental try-on service.',
    effect: 'This creates a priced add-on; scheduling and operational fulfillment still follow the store’s service process.',
  },
  'pricing.shipping': {
    title: 'Product delivery charge',
    meaning: 'Whether this product adds no delivery fee or a fixed delivery fee to new quotes.',
    why: 'It is stored as a versioned pricing component so checkout, manual booking, and financial records use the same amount.',
    example: 'Choose Flat Fee and ৳150 when every booking of this product has the same customer delivery charge.',
    effect: 'Courier procurement cost and COD remittance remain separate operational and financial records.',
  },
  'pricing.latePolicy': {
    title: 'Late-return policy',
    meaning: 'Defines grace time, late charges, and any cap after the agreed return time.',
    effect: 'Existing bookings keep their policy snapshot; edits affect new authoritative quotes.',
  },
  'pricing.estimate': {
    title: 'Configuration estimate',
    meaning: 'A planning preview calculated from the unsaved form values for a chosen number of rental days.',
    why: 'It helps spot obvious configuration mistakes before saving.',
    effect: 'It is not a customer quote. Checkout and booking totals always come from the backend quote engine and saved pricing version.',
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
