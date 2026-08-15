-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('active', 'suspended', 'cancelled');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('saas_admin', 'owner', 'manager', 'staff');

-- CreateEnum
CREATE TYPE "TenantRole" AS ENUM ('owner', 'manager', 'staff');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "ProductOnboardingSection" AS ENUM ('BASICS', 'SKUS', 'CONTENT', 'PRICING', 'REVIEW');

-- CreateEnum
CREATE TYPE "SizeSchemaStatus" AS ENUM ('draft', 'active', 'deprecated');

-- CreateEnum
CREATE TYPE "RatePlanType" AS ENUM ('PER_DAY', 'FLAT_PERIOD', 'TIERED_DAILY', 'WEEKLY_MONTHLY', 'PERCENT_RETAIL');

-- CreateEnum
CREATE TYPE "ComponentType" AS ENUM ('FEE', 'DEPOSIT', 'DISCOUNT', 'ADDON', 'SURCHARGE');

-- CreateEnum
CREATE TYPE "ComponentVisibility" AS ENUM ('CUSTOMER', 'STAFF_ONLY');

-- CreateEnum
CREATE TYPE "ChargeTiming" AS ENUM ('AT_BOOKING', 'AT_PICKUP', 'AT_RETURN', 'POST_RETURN');

-- CreateEnum
CREATE TYPE "PolicyVersionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DurationMode" AS ENUM ('CALENDAR_DAYS', 'NIGHTS');

-- CreateEnum
CREATE TYPE "BillingRounding" AS ENUM ('CEIL', 'FLOOR', 'NEAREST');

-- CreateEnum
CREATE TYPE "ConditionOperator" AS ENUM ('EQ', 'IN', 'GTE', 'LTE', 'BETWEEN', 'OVERLAPS');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('pending', 'confirmed', 'cancelled', 'delivered', 'overdue', 'returned', 'inspected', 'completed');

-- CreateEnum
CREATE TYPE "BookingChannel" AS ENUM ('STOREFRONT', 'OWNER_MANUAL');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('active', 'blocked', 'merged', 'anonymized', 'archived');

-- CreateEnum
CREATE TYPE "CustomerIdentityKind" AS ENUM ('phone', 'email');

-- CreateEnum
CREATE TYPE "CustomerAddressKind" AS ENUM ('delivery', 'billing', 'other');

-- CreateEnum
CREATE TYPE "CustomerContactChannel" AS ENUM ('phone', 'sms', 'whatsapp', 'email');

-- CreateEnum
CREATE TYPE "CustomerAccountStatus" AS ENUM ('invited', 'active', 'locked', 'disabled');

-- CreateEnum
CREATE TYPE "CustomerEventType" AS ENUM ('created', 'profile_updated', 'identity_added', 'address_added', 'tag_assigned', 'note_added', 'consent_changed', 'booking_created', 'payment_recorded', 'merged', 'anonymized', 'archived');

-- CreateEnum
CREATE TYPE "BookingHandoverMethod" AS ENUM ('DELIVERY', 'CUSTOMER_PICKUP');

-- CreateEnum
CREATE TYPE "BookingReturnMethod" AS ENUM ('BUSINESS_PICKUP', 'CUSTOMER_RETURN');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cod', 'bkash', 'nagad', 'sslcommerz');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('unpaid', 'partial', 'paid');

-- CreateEnum
CREATE TYPE "CancelledBy" AS ENUM ('customer', 'owner', 'system');

-- CreateEnum
CREATE TYPE "InventoryLocationType" AS ENUM ('WAREHOUSE', 'SHOWROOM', 'PICKUP_POINT', 'CLEANING_FACILITY', 'REPAIR_FACILITY', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "AvailabilityPolicyScope" AS ENUM ('TENANT', 'LOCATION', 'PRODUCT', 'SKU');

-- CreateEnum
CREATE TYPE "InventoryTransferStatus" AS ENUM ('DRAFT', 'READY', 'DISPATCHED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED', 'RECONCILIATION_REQUIRED', 'RECONCILED');

-- CreateEnum
CREATE TYPE "InventoryTransferUnitOutcome" AS ENUM ('PENDING', 'RECEIVED', 'DAMAGED', 'LOST');

-- CreateEnum
CREATE TYPE "StockConditionGrade" AS ENUM ('NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED');

-- CreateEnum
CREATE TYPE "StorefrontItemVisibilityMode" AS ENUM ('INTERNAL_ONLY', 'CONDITION_SUMMARY');

-- CreateEnum
CREATE TYPE "StorefrontCartStatus" AS ENUM ('ACTIVE', 'CHECKED_OUT', 'ABANDONED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "StockUnitDisposition" AS ENUM ('ACTIVE', 'QUARANTINED', 'LOST', 'RETIRED');

-- CreateEnum
CREATE TYPE "StockUnitOperationalState" AS ENUM ('AVAILABLE', 'PREPARING', 'READY', 'OUT_FOR_RENTAL', 'AWAITING_INSPECTION', 'CLEANING', 'WASHING', 'REPAIRING', 'IN_TRANSFER');

-- CreateEnum
CREATE TYPE "StockUnitInspectionType" AS ENUM ('PRE_RENTAL', 'RETURN', 'PERIODIC', 'SERVICE_COMPLETION');

-- CreateEnum
CREATE TYPE "StockUnitInspectionStatus" AS ENUM ('DRAFT', 'COMPLETED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "StockUnitInspectionDecision" AS ENUM ('AVAILABLE', 'CLEANING', 'WASHING', 'REPAIR', 'QUARANTINE', 'LOST', 'RETIRE');

-- CreateEnum
CREATE TYPE "InspectionCheckResult" AS ENUM ('PASS', 'FAIL', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "StockUnitIssueSeverity" AS ENUM ('INFO', 'MINOR', 'MODERATE', 'SEVERE', 'CRITICAL');

-- CreateEnum
CREATE TYPE "StockUnitIssueStatus" AS ENUM ('OPEN', 'IN_SERVICE', 'RESOLVED', 'WAIVED');

-- CreateEnum
CREATE TYPE "StockUnitIssueResponsibility" AS ENUM ('UNKNOWN', 'CUSTOMER', 'BUSINESS', 'NORMAL_WEAR', 'THIRD_PARTY');

-- CreateEnum
CREATE TYPE "InventoryServiceOrderType" AS ENUM ('PREPARATION', 'CLEANING', 'WASHING', 'REPAIR', 'ALTERATION', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "InventoryServiceOrderStatus" AS ENUM ('REQUESTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "StockUnitComponentPresence" AS ENUM ('PRESENT', 'MISSING', 'DAMAGED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "InventoryMediaPurpose" AS ENUM ('UNIT_REFERENCE', 'PRE_RENTAL', 'POST_RETURN', 'DAMAGE', 'SERVICE', 'CHECKLIST', 'OTHER');

-- CreateEnum
CREATE TYPE "InventoryReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'RELEASED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ProductCompositionRole" AS ENUM ('MAIN', 'REQUIRED_COMPONENT', 'OPTIONAL_ADDON');

-- CreateEnum
CREATE TYPE "CompositionSkuResolution" AS ENUM ('FIXED', 'CUSTOMER_SELECTED', 'PARENT_DERIVED', 'STAFF_SELECTED');

-- CreateEnum
CREATE TYPE "CompositionSubstitutionPolicy" AS ENUM ('NOT_ALLOWED', 'EQUIVALENT_ONLY', 'STAFF_APPROVAL', 'CUSTOMER_APPROVAL');

-- CreateEnum
CREATE TYPE "CompositionPricingBehavior" AS ENUM ('INCLUDED', 'ADDITIVE', 'OPTIONAL_PRICE');

-- CreateEnum
CREATE TYPE "FulfillmentSelectionSource" AS ENUM ('MAIN_PRODUCT', 'FIXED_RULE', 'CUSTOMER', 'PARENT_DERIVED', 'STAFF', 'SUBSTITUTION');

-- CreateEnum
CREATE TYPE "FulfillmentRequirementStatus" AS ENUM ('PLANNED', 'RESERVED', 'PARTIALLY_ASSIGNED', 'ASSIGNED', 'PARTIALLY_HANDED_OUT', 'HANDED_OUT', 'PARTIALLY_RETURNED', 'RETURNED', 'LOST', 'OVERDUE', 'CANCELLED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "FulfillmentPreparationStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'READY');

-- CreateEnum
CREATE TYPE "FulfillmentVersionAction" AS ENUM ('CREATED', 'MODIFIED', 'SUBSTITUTED', 'CANCELLED', 'OVERDUE_EXTENDED', 'RESOLVED_LOST');

-- CreateEnum
CREATE TYPE "FulfillmentApprovalStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FulfillmentEventType" AS ENUM ('RESERVED', 'ASSIGNED', 'ASSIGNMENT_RELEASED', 'PREPARATION_STARTED', 'PREPARATION_COMPLETED', 'HANDED_OUT', 'RETURNED', 'MARKED_LOST', 'OVERDUE', 'OVERDUE_RESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('UNIT_REGISTERED', 'CONDITION_CHANGED', 'VALUATION_CHANGED', 'MAINTENANCE_STARTED', 'MAINTENANCE_ENDED', 'UNIT_RETIRED', 'UNIT_LOST', 'UNIT_RECOVERED', 'ADMIN_CORRECTION', 'TRANSFER_RESERVED', 'TRANSFER_DISPATCHED', 'TRANSFER_RECEIVED', 'TRANSFER_CANCELLED', 'COUNT_CORRECTION', 'DAMAGE_WRITE_OFF');

-- CreateEnum
CREATE TYPE "InventoryCountSessionStatus" AS ENUM ('DRAFT', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InventoryCountIdentityMatch" AS ENUM ('ASSET_CODE', 'BARCODE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "StockUnitRevenueAllocationKind" AS ENUM ('RENTAL_REVENUE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "InventoryBlockType" AS ENUM ('MANUAL', 'MAINTENANCE', 'INSPECTION', 'SERVICE', 'TRANSFER', 'LOCATION_BLACKOUT', 'SKU_BLACKOUT');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('pending', 'collected', 'held', 'refunded', 'partially_refunded', 'forfeited');

-- CreateEnum
CREATE TYPE "DamageLevel" AS ENUM ('none', 'minor', 'moderate', 'severe', 'destroyed', 'lost');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('pending', 'verified', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "ShipmentDirection" AS ENUM ('OUTBOUND', 'RETURN');

-- CreateEnum
CREATE TYPE "ShipmentProvider" AS ENUM ('pathao', 'steadfast', 'manual');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('prepare_parcel', 'pickup_pending', 'pickup_assigned', 'pickup_failed', 'picked_up', 'at_hub', 'in_transit', 'at_destination', 'out_for_delivery', 'delivered', 'partial_delivered', 'returned_to_sender', 'cancelled', 'on_hold', 'error', 'unknown');

-- CreateEnum
CREATE TYPE "ShipmentDispatchAttemptStatus" AS ENUM ('STARTED', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "CodReconciliationStatus" AS ENUM ('PENDING', 'PARTIAL', 'RECONCILED', 'DISPUTED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'past_due', 'cancelled', 'trial', 'free_tier', 'grace_period', 'suspended');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('monthly', 'annual');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('desktop', 'mobile', 'tablet');

-- CreateEnum
CREATE TYPE "LoginEventType" AS ENUM ('login_success', 'login_failed', 'session_revoked', 'logout', 'token_refreshed');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'owner',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colors" (
    "id" TEXT NOT NULL,
    "system_key" TEXT,
    "name" TEXT NOT NULL,
    "hex_code" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "tenant_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "colors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "features" JSONB,
    "badge" TEXT,
    "price_monthly" INTEGER NOT NULL DEFAULT 0,
    "price_annual" INTEGER,
    "trial_days" INTEGER NOT NULL DEFAULT 0,
    "max_products" INTEGER,
    "max_orders" INTEGER,
    "max_staff" INTEGER NOT NULL DEFAULT 0,
    "custom_domain" BOOLEAN NOT NULL DEFAULT false,
    "sms_enabled" BOOLEAN NOT NULL DEFAULT false,
    "analytics_full" BOOLEAN NOT NULL DEFAULT false,
    "remove_branding" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "max_api_calls_daily" INTEGER,
    "max_storage_mb" INTEGER,
    "max_rpm" INTEGER NOT NULL DEFAULT 120,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "starter_templates" (
    "id" TEXT NOT NULL,
    "template_name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "starter_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "custom_domain" TEXT,
    "owner_user_id" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'active',
    "status_reason" TEXT,
    "plan_id" TEXT,
    "logo_url" TEXT,
    "favicon_url" TEXT,
    "referral_source" TEXT,
    "promo_code_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_usage_snapshots" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "snapshot_date" DATE NOT NULL,
    "api_request_count" INTEGER NOT NULL DEFAULT 0,
    "avg_response_time_ms" INTEGER NOT NULL DEFAULT 0,
    "p95_response_time_ms" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "total_bandwidth_kb" INTEGER NOT NULL DEFAULT 0,
    "peak_rpm" INTEGER NOT NULL DEFAULT 0,
    "product_count" INTEGER NOT NULL DEFAULT 0,
    "booking_count" INTEGER NOT NULL DEFAULT 0,
    "customer_count" INTEGER NOT NULL DEFAULT 0,
    "staff_count" INTEGER NOT NULL DEFAULT 0,
    "storage_used_mb" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_usage_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "primary_color" TEXT NOT NULL DEFAULT '#6366F1',
    "secondary_color" TEXT,
    "tagline" TEXT,
    "about" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "address" TEXT,
    "facebook_url" TEXT,
    "instagram_url" TEXT,
    "tiktok_url" TEXT,
    "youtube_url" TEXT,
    "default_language" TEXT NOT NULL DEFAULT 'en',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "country" TEXT NOT NULL DEFAULT 'BD',
    "currency_code" TEXT NOT NULL DEFAULT 'BDT',
    "currency_symbol" TEXT NOT NULL DEFAULT '৳',
    "currency_position" TEXT NOT NULL DEFAULT 'before',
    "number_format" TEXT NOT NULL DEFAULT 'south_asian',
    "date_format" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
    "time_format" TEXT NOT NULL DEFAULT '12h',
    "week_start" TEXT NOT NULL DEFAULT 'saturday',
    "sms_enabled" BOOLEAN NOT NULL DEFAULT true,
    "bkash_number" TEXT,
    "nagad_number" TEXT,
    "sslcommerz_store_id" TEXT,
    "sslcommerz_store_pass" TEXT,
    "sslcommerz_sandbox" BOOLEAN NOT NULL DEFAULT true,
    "pickup_address" TEXT,
    "pickup_city" TEXT,
    "pickup_lead_days" INTEGER DEFAULT 2,
    "pickup_lead_days_config" JSONB,
    "max_concurrent_sessions" INTEGER NOT NULL DEFAULT 5,
    "buffer_days" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courier_connections" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "provider" "ShipmentProvider" NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL DEFAULT '{}',
    "credentials_encrypted" TEXT,
    "credential_key_version" INTEGER NOT NULL DEFAULT 1,
    "webhook_token" TEXT NOT NULL,
    "health_status" TEXT NOT NULL DEFAULT 'not_tested',
    "last_health_check_at" TIMESTAMP(3),
    "last_health_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courier_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_users" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "TenantRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_invitations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "role" "TenantRole" NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "token_hash" TEXT NOT NULL,
    "invited_by_user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "billing_cycle" "BillingCycle" NOT NULL DEFAULT 'monthly',
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "trial_ends_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "user_id" TEXT NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "device_name" TEXT NOT NULL,
    "device_type" "DeviceType" NOT NULL,
    "browser" TEXT NOT NULL,
    "os" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "location" TEXT,
    "last_active_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_history" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "user_id" TEXT NOT NULL,
    "event_type" "LoginEventType" NOT NULL,
    "browser" TEXT,
    "os" TEXT,
    "ip_address" TEXT,
    "location" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_digest" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "creation_key" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "category_id" TEXT NOT NULL,
    "subcategory_id" TEXT,
    "product_type_id" TEXT,
    "size_schema_override_id" TEXT,
    "status" "ProductStatus" NOT NULL DEFAULT 'draft',
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "available_from" DATE,
    "unavailable_reason" TEXT,
    "country_of_origin" TEXT,
    "country_of_origin_public" BOOLEAN NOT NULL DEFAULT false,
    "reference_retail_value" INTEGER,
    "reference_retail_value_public" BOOLEAN NOT NULL DEFAULT false,
    "storefront_item_mode" "StorefrontItemVisibilityMode" NOT NULL DEFAULT 'INTERNAL_ONLY',
    "total_bookings" INTEGER NOT NULL DEFAULT 0,
    "total_revenue" INTEGER NOT NULL DEFAULT 0,
    "popularity_score" INTEGER NOT NULL DEFAULT 0,
    "search_vector" tsvector,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_user_id" TEXT,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_onboardings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "current_section" "ProductOnboardingSection" NOT NULL DEFAULT 'BASICS',
    "completed_sections" "ProductOnboardingSection"[] DEFAULT ARRAY[]::"ProductOnboardingSection"[],
    "revision" INTEGER NOT NULL DEFAULT 0,
    "created_by_user_id" TEXT NOT NULL,
    "updated_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_onboardings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_onboarding_commands" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "onboarding_id" TEXT NOT NULL,
    "section" "ProductOnboardingSection" NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "revision_before" INTEGER NOT NULL,
    "revision_after" INTEGER NOT NULL,
    "result" JSONB NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_onboarding_commands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "onboarding_key" TEXT,
    "variant_name" TEXT,
    "main_color_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variant_sizes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "size_instance_id" TEXT NOT NULL,
    "inventory_version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "variant_sizes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variant_colors" (
    "id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "color_id" TEXT NOT NULL,

    CONSTRAINT "variant_colors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnail_url" TEXT NOT NULL,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "original_name" TEXT,
    "file_size" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_detail_headers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "header_name" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_detail_headers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_detail_entries" (
    "id" TEXT NOT NULL,
    "header_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_detail_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_profiles" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BDT',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Dhaka',
    "duration_mode" "DurationMode" NOT NULL DEFAULT 'CALENDAR_DAYS',
    "billing_rounding" "BillingRounding" NOT NULL DEFAULT 'CEIL',
    "active_policy_version_id" TEXT,
    "headline_price_minor" INTEGER NOT NULL DEFAULT 0,
    "headline_label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_policy_versions" (
    "id" TEXT NOT NULL,
    "pricing_profile_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "PolicyVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "effective_from" TIMESTAMPTZ,
    "effective_to" TIMESTAMPTZ,
    "published_at" TIMESTAMPTZ,
    "snapshot_config" JSONB,
    "late_fee_policy" JSONB,
    "presentation_config" JSONB,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_policy_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_plans" (
    "id" TEXT NOT NULL,
    "policy_version_id" TEXT NOT NULL,
    "type" "RatePlanType" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "config" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_components" (
    "id" TEXT NOT NULL,
    "policy_version_id" TEXT NOT NULL,
    "type" "ComponentType" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "visibility" "ComponentVisibility" NOT NULL DEFAULT 'CUSTOMER',
    "charge_timing" "ChargeTiming" NOT NULL DEFAULT 'AT_BOOKING',
    "refundable" BOOLEAN NOT NULL DEFAULT false,
    "exclusive_group" TEXT,
    "config" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "condition_sets" (
    "id" TEXT NOT NULL,
    "rate_plan_id" TEXT,
    "component_id" TEXT,

    CONSTRAINT "condition_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conditions" (
    "id" TEXT NOT NULL,
    "condition_set_id" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "operator" "ConditionOperator" NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "policy_version_id" TEXT NOT NULL,
    "start_at" TIMESTAMPTZ NOT NULL,
    "end_at" TIMESTAMPTZ NOT NULL,
    "customer_context" JSONB,
    "selected_addons" JSONB,
    "inputs_hash" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BDT',
    "billable_days" INTEGER NOT NULL,
    "subtotal_minor" INTEGER NOT NULL,
    "deposit_minor" INTEGER NOT NULL,
    "total_due_now_minor" INTEGER NOT NULL,
    "total_due_later_minor" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_line_items" (
    "id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "refundable" BOOLEAN NOT NULL DEFAULT false,
    "visibility" "ComponentVisibility" NOT NULL DEFAULT 'CUSTOMER',
    "metadata" JSONB,

    CONSTRAINT "quote_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_quotes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "inputs_hash" TEXT NOT NULL,
    "quote_hash" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BDT',
    "source_location_id" TEXT NOT NULL,
    "rental_start_date" DATE NOT NULL,
    "rental_end_date" DATE NOT NULL,
    "handover_method" "BookingHandoverMethod" NOT NULL,
    "return_method" "BookingReturnMethod" NOT NULL,
    "request_snapshot" JSONB NOT NULL,
    "itemized_lines" JSONB NOT NULL,
    "availability_plan" JSONB NOT NULL,
    "policy_version_ids" JSONB NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "total_fees" INTEGER NOT NULL DEFAULT 0,
    "shipping_fee" INTEGER NOT NULL DEFAULT 0,
    "total_deposit" INTEGER NOT NULL DEFAULT 0,
    "discount_amount" INTEGER NOT NULL DEFAULT 0,
    "grand_total" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storefront_checkout_quotes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "cart_id" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "quote_hash" TEXT NOT NULL,
    "request_snapshot" JSONB NOT NULL,
    "response_snapshot" JSONB NOT NULL,
    "grand_total" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storefront_checkout_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storefront_carts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "status" "StorefrontCartStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMPTZ NOT NULL,
    "last_activity_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storefront_carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storefront_cart_lines" (
    "id" TEXT NOT NULL,
    "cart_id" TEXT NOT NULL,
    "line_key" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "variant_size_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "selected_size" TEXT,
    "configuration" JSONB NOT NULL DEFAULT '{}',
    "display_snapshot" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storefront_cart_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_types" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" VARCHAR(255),
    "default_size_schema_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "size_schemas" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" VARCHAR(255),
    "schema_type" TEXT NOT NULL DEFAULT 'STANDARD',
    "status" "SizeSchemaStatus" NOT NULL DEFAULT 'draft',
    "definition" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "size_schemas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "size_instances" (
    "id" TEXT NOT NULL,
    "size_schema_id" TEXT NOT NULL,
    "normalized_key" TEXT NOT NULL,
    "display_label" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "size_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "size_charts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "size_schema_id" TEXT NOT NULL,
    "product_id" TEXT,
    "title" TEXT NOT NULL DEFAULT 'Size Guide',
    "chartMeta" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "size_charts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "size_chart_rows" (
    "id" TEXT NOT NULL,
    "size_chart_id" TEXT NOT NULL,
    "size_label" TEXT NOT NULL,
    "measurements" JSONB NOT NULL DEFAULT '{}',
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "size_chart_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subcategories" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subcategories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_events" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,

    CONSTRAINT "product_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_faqs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "status" "CustomerStatus" NOT NULL DEFAULT 'active',
    "preferred_contact_channel" "CustomerContactChannel" NOT NULL DEFAULT 'phone',
    "preferred_locale" TEXT NOT NULL DEFAULT 'en-BD',
    "source" TEXT,
    "total_bookings" INTEGER NOT NULL DEFAULT 0,
    "total_spent" INTEGER NOT NULL DEFAULT 0,
    "last_booking_at" TIMESTAMP(3),
    "merged_into_customer_id" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_identities" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "kind" "CustomerIdentityKind" NOT NULL,
    "value" TEXT NOT NULL,
    "normalized_value" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_addresses" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "kind" "CustomerAddressKind" NOT NULL DEFAULT 'delivery',
    "label" TEXT,
    "recipient_name" TEXT,
    "phone" TEXT,
    "address_line1" TEXT NOT NULL,
    "address_line2" TEXT,
    "area" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,
    "country" TEXT NOT NULL DEFAULT 'BD',
    "instructions" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "last_used_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_tag_definitions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_tag_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_tag_assignments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "assigned_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_tag_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_notes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_consents" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "channel" "CustomerContactChannel",
    "granted" BOOLEAN NOT NULL,
    "source" TEXT NOT NULL,
    "recorded_by" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "type" "CustomerEventType" NOT NULL,
    "summary" TEXT NOT NULL,
    "data" JSONB,
    "actor_id" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_accounts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "login_identity_id" TEXT,
    "status" "CustomerAccountStatus" NOT NULL DEFAULT 'invited',
    "password_hash" TEXT,
    "invited_at" TIMESTAMP(3),
    "activated_at" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "locked_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "creation_key" TEXT,
    "creation_request_hash" TEXT,
    "booking_number" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "quote_id" TEXT,
    "storefront_quote_id" TEXT,
    "storefront_cart_id" TEXT,
    "public_tracking_token" TEXT NOT NULL,
    "policy_version_id" TEXT,
    "channel" "BookingChannel" NOT NULL DEFAULT 'STOREFRONT',
    "rental_start_date" DATE,
    "rental_end_date" DATE,
    "source_location_id" TEXT,
    "handover_method" "BookingHandoverMethod",
    "return_method" "BookingReturnMethod",
    "status" "BookingStatus" NOT NULL DEFAULT 'pending',
    "payment_method" "PaymentMethod" NOT NULL,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'unpaid',
    "subtotal" INTEGER NOT NULL,
    "total_fees" INTEGER NOT NULL DEFAULT 0,
    "shipping_fee" INTEGER NOT NULL DEFAULT 0,
    "total_deposit" INTEGER NOT NULL DEFAULT 0,
    "grand_total" INTEGER NOT NULL,
    "total_paid" INTEGER NOT NULL DEFAULT 0,
    "discount_amount" INTEGER NOT NULL DEFAULT 0,
    "discount_type" TEXT,
    "discount_reason" TEXT,
    "delivery_name" TEXT NOT NULL,
    "delivery_phone" TEXT NOT NULL,
    "delivery_alt_phone" TEXT,
    "delivery_address_line1" TEXT NOT NULL,
    "delivery_address_line2" TEXT,
    "delivery_city" TEXT NOT NULL,
    "delivery_state" TEXT,
    "delivery_postal_code" TEXT,
    "delivery_country" TEXT NOT NULL,
    "delivery_extra" JSONB,
    "customer_notes" TEXT,
    "internal_notes" TEXT,
    "cancellation_reason" TEXT,
    "cancelled_by" "CancelledBy",
    "cancelled_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "returned_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "direction" "ShipmentDirection" NOT NULL DEFAULT 'OUTBOUND',
    "provider" "ShipmentProvider" NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'prepare_parcel',
    "idempotency_key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "provider_reference" TEXT,
    "tracking_number" TEXT,
    "sender_name" TEXT,
    "sender_phone" TEXT,
    "sender_address" TEXT,
    "sender_city" TEXT,
    "sender_zone" TEXT,
    "recipient_name" TEXT NOT NULL,
    "recipient_phone" TEXT NOT NULL,
    "recipient_address" TEXT NOT NULL,
    "recipient_city" TEXT NOT NULL,
    "recipient_zone" TEXT,
    "cod_amount" INTEGER NOT NULL DEFAULT 0,
    "quoted_fee" INTEGER,
    "charged_fee" INTEGER,
    "weight_grams" INTEGER NOT NULL DEFAULT 1000,
    "item_quantity" INTEGER NOT NULL DEFAULT 1,
    "special_instruction" TEXT,
    "scheduled_pickup_at" TIMESTAMP(3),
    "pickup_requested_at" TIMESTAMP(3),
    "last_synced_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "failed_reason" TEXT,
    "raw_create_response" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_dispatch_attempts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "shipment_id" TEXT NOT NULL,
    "provider" "ShipmentProvider" NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "status" "ShipmentDispatchAttemptStatus" NOT NULL DEFAULT 'STARTED',
    "provider_reference" TEXT,
    "tracking_number" TEXT,
    "response_snapshot" JSONB,
    "error_reason" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "shipment_dispatch_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cod_remittances" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "shipment_id" TEXT NOT NULL,
    "payment_id" TEXT,
    "expected_amount" INTEGER NOT NULL,
    "remitted_amount" INTEGER NOT NULL DEFAULT 0,
    "fee_deducted" INTEGER NOT NULL DEFAULT 0,
    "status" "CodReconciliationStatus" NOT NULL DEFAULT 'PENDING',
    "provider_reference" TEXT,
    "remitted_at" TIMESTAMP(3),
    "reconciled_at" TIMESTAMP(3),
    "reconciled_by_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cod_remittances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_items" (
    "id" TEXT NOT NULL,
    "shipment_id" TEXT NOT NULL,
    "booking_item_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "shipment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "shipment_id" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL,
    "label" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "provider_event_id" TEXT,
    "dedupe_key" TEXT NOT NULL,
    "raw_payload" JSONB,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courier_webhook_receipts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "shipment_id" TEXT,
    "provider" "ShipmentProvider" NOT NULL,
    "external_event_id" TEXT,
    "payload_hash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed_at" TIMESTAMP(3),
    "error_reason" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courier_webhook_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "product_id" TEXT,
    "variant_id" TEXT NOT NULL,
    "variant_size_id" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "product_name" TEXT NOT NULL,
    "variant_name" TEXT,
    "color_name" TEXT NOT NULL,
    "size_info" TEXT,
    "featured_image_url" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "rental_days" INTEGER NOT NULL,
    "base_rental" INTEGER NOT NULL,
    "extended_days" INTEGER NOT NULL DEFAULT 0,
    "extended_cost" INTEGER NOT NULL DEFAULT 0,
    "deposit_amount" INTEGER NOT NULL DEFAULT 0,
    "deposit_status" "DepositStatus" NOT NULL DEFAULT 'pending',
    "deposit_refund_amount" INTEGER,
    "deposit_refund_date" TIMESTAMP(3),
    "deposit_refund_method" TEXT,
    "cleaning_fee" INTEGER NOT NULL DEFAULT 0,
    "backup_size" TEXT,
    "backup_size_fee" INTEGER NOT NULL DEFAULT 0,
    "try_on_fee" INTEGER NOT NULL DEFAULT 0,
    "try_on_credited" BOOLEAN NOT NULL DEFAULT false,
    "item_total" INTEGER NOT NULL,
    "fulfillment_adjustment" INTEGER NOT NULL DEFAULT 0,
    "quoted_item_total" INTEGER,
    "price_override_amount" INTEGER,
    "price_override_reason" TEXT,
    "late_fee" INTEGER NOT NULL DEFAULT 0,
    "late_days" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "damage_reports" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "booking_item_id" TEXT NOT NULL,
    "stock_unit_issue_id" TEXT,
    "damage_level" "DamageLevel" NOT NULL,
    "description" TEXT NOT NULL,
    "estimated_repair_cost" INTEGER,
    "deduction_amount" INTEGER NOT NULL DEFAULT 0,
    "additional_charge" INTEGER NOT NULL DEFAULT 0,
    "photos" TEXT[],
    "reported_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "damage_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposit_settlements" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "booking_item_id" TEXT NOT NULL,
    "damage_report_id" TEXT,
    "refund_amount" INTEGER NOT NULL DEFAULT 0,
    "deduction_amount" INTEGER NOT NULL DEFAULT 0,
    "forfeited_amount" INTEGER NOT NULL DEFAULT 0,
    "additional_charge" INTEGER NOT NULL DEFAULT 0,
    "refund_method" TEXT,
    "reason" TEXT NOT NULL,
    "evidence_snapshot" JSONB,
    "idempotency_key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deposit_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_locations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location_type" "InventoryLocationType" NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Dhaka',
    "address_line_1" TEXT,
    "address_line_2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,
    "country" TEXT NOT NULL DEFAULT 'BD',
    "contact_name" TEXT,
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "can_store_inventory" BOOLEAN NOT NULL DEFAULT true,
    "can_fulfill_rentals" BOOLEAN NOT NULL DEFAULT true,
    "can_customer_pickup" BOOLEAN NOT NULL DEFAULT false,
    "can_accept_returns" BOOLEAN NOT NULL DEFAULT true,
    "can_clean" BOOLEAN NOT NULL DEFAULT false,
    "can_repair" BOOLEAN NOT NULL DEFAULT false,
    "can_transfer" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_policies" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "scope" "AvailabilityPolicyScope" NOT NULL,
    "scope_key" TEXT NOT NULL,
    "location_id" TEXT,
    "product_id" TEXT,
    "variant_size_id" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "preparation_buffer_minutes" INTEGER,
    "delivery_buffer_minutes" INTEGER,
    "return_buffer_minutes" INTEGER,
    "inspection_buffer_minutes" INTEGER,
    "cleaning_buffer_minutes" INTEGER,
    "minimum_notice_minutes" INTEGER,
    "maximum_advance_days" INTEGER,
    "pending_hold_minutes" INTEGER,
    "allow_shortage" BOOLEAN,
    "shortage_limit" INTEGER,
    "require_single_location_for_bundle" BOOLEAN,
    "allow_cross_location_transfers" BOOLEAN,
    "transfer_lead_time_minutes" INTEGER,
    "eligible_condition_grades" JSONB,
    "eligible_operational_states" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "availability_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transfers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "transfer_number" TEXT NOT NULL,
    "origin_location_id" TEXT NOT NULL,
    "destination_location_id" TEXT NOT NULL,
    "status" "InventoryTransferStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "cancellation_reason" TEXT,
    "reconciliation_reason" TEXT,
    "reconciled_at" TIMESTAMP(3),
    "expected_dispatch_at" TIMESTAMP(3),
    "expected_arrival_at" TIMESTAMP(3),
    "ready_at" TIMESTAMP(3),
    "dispatched_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_by_user_id" TEXT NOT NULL,
    "approved_by_user_id" TEXT,
    "dispatched_by_user_id" TEXT,
    "received_by_user_id" TEXT,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transfer_lines" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "transfer_id" TEXT NOT NULL,
    "variant_size_id" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_transfer_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transfer_units" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "transfer_line_id" TEXT NOT NULL,
    "stock_unit_id" TEXT NOT NULL,
    "outcome" "InventoryTransferUnitOutcome" NOT NULL DEFAULT 'PENDING',
    "dispatched_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_transfer_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transfer_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "transfer_id" TEXT NOT NULL,
    "from_status" "InventoryTransferStatus",
    "to_status" "InventoryTransferStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "actor_user_id" TEXT NOT NULL,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transfer_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_units" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "variant_size_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "asset_code" TEXT NOT NULL,
    "barcode" TEXT,
    "disposition" "StockUnitDisposition" NOT NULL DEFAULT 'ACTIVE',
    "operational_state" "StockUnitOperationalState" NOT NULL DEFAULT 'AVAILABLE',
    "condition" "StockConditionGrade" NOT NULL DEFAULT 'GOOD',
    "storefront_visible" BOOLEAN NOT NULL DEFAULT false,
    "public_condition_note" TEXT,
    "rental_price_adjustment" INTEGER NOT NULL DEFAULT 0,
    "estimated_current_value" INTEGER,
    "storefront_sort_order" INTEGER NOT NULL DEFAULT 0,
    "acquisition_date" DATE,
    "acquisition_cost" INTEGER,
    "acquisition_source" VARCHAR(200),
    "acquisition_reference" VARCHAR(200),
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "registration_key" TEXT,
    "registration_hash" TEXT,
    "registration_row" INTEGER,
    "retired_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_composition_rules" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "parent_product_id" TEXT NOT NULL,
    "component_product_id" TEXT,
    "fixed_variant_size_id" TEXT,
    "role" "ProductCompositionRole" NOT NULL,
    "name" TEXT NOT NULL,
    "selection_group_key" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "sku_resolution" "CompositionSkuResolution" NOT NULL,
    "substitution_policy" "CompositionSubstitutionPolicy" NOT NULL DEFAULT 'NOT_ALLOWED',
    "pricing_behavior" "CompositionPricingBehavior" NOT NULL DEFAULT 'INCLUDED',
    "price_adjustment" INTEGER NOT NULL DEFAULT 0,
    "allocation_weight" INTEGER NOT NULL DEFAULT 1,
    "is_default_selected" BOOLEAN NOT NULL DEFAULT false,
    "customer_approval_required" BOOLEAN NOT NULL DEFAULT false,
    "compatibility_rules" JSONB,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "configuration_version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_composition_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_composition_alternatives" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_size_id" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "compatibility_rule" JSONB,
    "price_adjustment" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_composition_alternatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fulfillment_requirements" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "booking_item_id" TEXT NOT NULL,
    "composition_rule_id" TEXT,
    "selected_alternative_id" TEXT,
    "parent_requirement_id" TEXT,
    "requirement_key" TEXT NOT NULL,
    "role" "ProductCompositionRole" NOT NULL,
    "selection_source" "FulfillmentSelectionSource" NOT NULL,
    "status" "FulfillmentRequirementStatus" NOT NULL DEFAULT 'PLANNED',
    "preparation_status" "FulfillmentPreparationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "prepared_at" TIMESTAMP(3),
    "product_id" TEXT NOT NULL,
    "variant_size_id" TEXT NOT NULL,
    "source_location_id" TEXT NOT NULL,
    "availability_policy_snapshot" JSONB NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "assigned_quantity" INTEGER NOT NULL DEFAULT 0,
    "handed_out_quantity" INTEGER NOT NULL DEFAULT 0,
    "returned_quantity" INTEGER NOT NULL DEFAULT 0,
    "lost_quantity" INTEGER NOT NULL DEFAULT 0,
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "product_name_snapshot" TEXT NOT NULL,
    "variant_name_snapshot" TEXT,
    "size_snapshot" TEXT,
    "rule_snapshot" JSONB,
    "customer_selection_snapshot" JSONB,
    "rental_start_date" DATE NOT NULL,
    "rental_end_date" DATE NOT NULL,
    "blocked_start_date" DATE NOT NULL,
    "blocked_end_date" DATE NOT NULL,
    "price_adjustment" INTEGER NOT NULL DEFAULT 0,
    "revenue_allocation" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fulfillment_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fulfillment_requirement_versions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "requirement_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "action" "FulfillmentVersionAction" NOT NULL,
    "product_id" TEXT,
    "variant_size_id" TEXT,
    "quantity" INTEGER NOT NULL,
    "rental_start_date" DATE NOT NULL,
    "rental_end_date" DATE NOT NULL,
    "blocked_start_date" DATE NOT NULL,
    "blocked_end_date" DATE NOT NULL,
    "selection_source" "FulfillmentSelectionSource" NOT NULL,
    "snapshot" JSONB,
    "reason" TEXT NOT NULL,
    "price_impact" INTEGER NOT NULL DEFAULT 0,
    "actor_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fulfillment_requirement_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fulfillment_selection_snapshots" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "booking_item_id" TEXT NOT NULL,
    "requirement_id" TEXT,
    "composition_rule_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_size_id" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "selected_by" "FulfillmentSelectionSource" NOT NULL,
    "selection_snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fulfillment_selection_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fulfillment_substitutions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "requirement_id" TEXT NOT NULL,
    "from_version" INTEGER NOT NULL,
    "to_version" INTEGER NOT NULL,
    "from_product_id" TEXT NOT NULL,
    "from_variant_size_id" TEXT NOT NULL,
    "to_product_id" TEXT NOT NULL,
    "to_variant_size_id" TEXT NOT NULL,
    "compatibility_result" JSONB,
    "approval_status" "FulfillmentApprovalStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "customer_approved_at" TIMESTAMP(3),
    "approval_evidence" TEXT,
    "price_impact" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fulfillment_substitutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fulfillment_extensions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "previous_end_date" DATE NOT NULL,
    "rental_end_date" DATE NOT NULL,
    "extension_charge" INTEGER NOT NULL DEFAULT 0,
    "approval_evidence" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fulfillment_extensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fulfillment_requirement_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "requirement_id" TEXT NOT NULL,
    "assignment_id" TEXT,
    "event_type" "FulfillmentEventType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "from_status" "FulfillmentRequirementStatus",
    "to_status" "FulfillmentRequirementStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "actor_user_id" TEXT,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fulfillment_requirement_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_reservations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "booking_item_id" TEXT NOT NULL,
    "fulfillment_requirement_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_size_id" TEXT NOT NULL,
    "source_location_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "rental_start_date" DATE NOT NULL,
    "rental_end_date" DATE NOT NULL,
    "blocked_start_date" DATE NOT NULL,
    "blocked_end_date" DATE NOT NULL,
    "status" "InventoryReservationStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3),
    "released_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "release_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_unit_assignments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "stock_unit_id" TEXT NOT NULL,
    "assigned_by_user_id" TEXT,
    "blocked_start_date" DATE NOT NULL,
    "blocked_end_date" DATE NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMP(3),
    "release_reason" TEXT,

    CONSTRAINT "stock_unit_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_unit_revenue_allocations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "stock_unit_id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "booking_item_id" TEXT NOT NULL,
    "fulfillment_requirement_id" TEXT NOT NULL,
    "allocation_kind" "StockUnitRevenueAllocationKind" NOT NULL,
    "amount" INTEGER NOT NULL,
    "source_key" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_unit_revenue_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "variant_size_id" TEXT,
    "stock_unit_id" TEXT NOT NULL,
    "origin_location_id" TEXT,
    "destination_location_id" TEXT,
    "transfer_id" TEXT,
    "transfer_line_id" TEXT,
    "reservation_id" TEXT,
    "count_session_id" TEXT,
    "movement_type" "InventoryMovementType" NOT NULL,
    "before_state" JSONB,
    "after_state" JSONB,
    "reason" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_count_sessions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "status" "InventoryCountSessionStatus" NOT NULL DEFAULT 'COMPLETED',
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "expected_count" INTEGER NOT NULL,
    "observed_unique_count" INTEGER NOT NULL,
    "missing_count" INTEGER NOT NULL,
    "unexpected_count" INTEGER NOT NULL,
    "duplicate_scan_count" INTEGER NOT NULL,
    "unknown_scan_count" INTEGER NOT NULL,
    "wrong_location_count" INTEGER NOT NULL,
    "operational_review_count" INTEGER NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "completed_by_user_id" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_count_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_count_observations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "count_session_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "scanned_identity" TEXT NOT NULL,
    "identity_match" "InventoryCountIdentityMatch" NOT NULL,
    "stock_unit_id" TEXT,
    "is_duplicate" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_count_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_count_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "count_session_id" TEXT NOT NULL,
    "stock_unit_id" TEXT NOT NULL,
    "expected_at_location" BOOLEAN NOT NULL,
    "observed" BOOLEAN NOT NULL,
    "scan_count" INTEGER NOT NULL,
    "missing" BOOLEAN NOT NULL,
    "unexpected" BOOLEAN NOT NULL,
    "wrong_location" BOOLEAN NOT NULL,
    "requires_operational_review" BOOLEAN NOT NULL,
    "recorded_location_id" TEXT NOT NULL,
    "recorded_disposition" "StockUnitDisposition" NOT NULL,
    "recorded_operational_state" "StockUnitOperationalState" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_count_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_blocks" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT,
    "variant_id" TEXT,
    "variant_size_id" TEXT,
    "stock_unit_id" TEXT,
    "location_id" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "block_type" "InventoryBlockType" NOT NULL,
    "reason" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_unit_lifecycle_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "stock_unit_id" TEXT NOT NULL,
    "assignment_id" TEXT,
    "inspection_id" TEXT,
    "service_order_id" TEXT,
    "issue_id" TEXT,
    "actor_user_id" TEXT,
    "from_disposition" "StockUnitDisposition" NOT NULL,
    "to_disposition" "StockUnitDisposition" NOT NULL,
    "from_operational_state" "StockUnitOperationalState" NOT NULL,
    "to_operational_state" "StockUnitOperationalState" NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_unit_lifecycle_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_unit_inspections" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "stock_unit_id" TEXT NOT NULL,
    "booking_item_id" TEXT,
    "assignment_id" TEXT,
    "service_order_id" TEXT,
    "inventory_block_id" TEXT,
    "inspection_type" "StockUnitInspectionType" NOT NULL,
    "status" "StockUnitInspectionStatus" NOT NULL DEFAULT 'DRAFT',
    "condition_before" "StockConditionGrade" NOT NULL,
    "condition_after" "StockConditionGrade",
    "decision" "StockUnitInspectionDecision",
    "notes" TEXT,
    "customer_liability_note" TEXT,
    "inspected_by_user_id" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3),
    "amends_inspection_id" TEXT,
    "create_idempotency_key" TEXT,
    "completion_idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_unit_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_unit_inspection_checks" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "inspection_id" TEXT NOT NULL,
    "set_component_definition_id" TEXT,
    "label_snapshot" TEXT NOT NULL,
    "expected_quantity" INTEGER NOT NULL DEFAULT 1,
    "observed_quantity" INTEGER,
    "result" "InspectionCheckResult" NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_unit_inspection_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_unit_issues" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "stock_unit_id" TEXT NOT NULL,
    "inspection_id" TEXT,
    "booking_item_id" TEXT,
    "assignment_id" TEXT,
    "issue_type" TEXT NOT NULL,
    "severity" "StockUnitIssueSeverity" NOT NULL,
    "status" "StockUnitIssueStatus" NOT NULL DEFAULT 'OPEN',
    "responsibility" "StockUnitIssueResponsibility" NOT NULL DEFAULT 'UNKNOWN',
    "description" TEXT NOT NULL,
    "is_availability_blocking" BOOLEAN NOT NULL DEFAULT true,
    "estimated_cost" INTEGER,
    "customer_charge" INTEGER,
    "reported_by_user_id" TEXT NOT NULL,
    "resolved_by_user_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolution_notes" TEXT,
    "resolution_idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_unit_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_service_orders" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "stock_unit_id" TEXT NOT NULL,
    "issue_id" TEXT,
    "source_inspection_id" TEXT,
    "inventory_block_id" TEXT,
    "service_type" "InventoryServiceOrderType" NOT NULL,
    "status" "InventoryServiceOrderStatus" NOT NULL DEFAULT 'REQUESTED',
    "is_availability_blocking" BOOLEAN NOT NULL DEFAULT true,
    "provider_name" TEXT,
    "service_location_id" TEXT NOT NULL,
    "requested_by_user_id" TEXT NOT NULL,
    "completed_by_user_id" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduled_start_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "expected_completion_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "cost" INTEGER,
    "notes" TEXT,
    "completion_outcome" TEXT,
    "create_idempotency_key" TEXT,
    "completion_idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_service_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sku_set_component_definitions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "variant_size_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "required_quantity" INTEGER NOT NULL DEFAULT 1,
    "inspection_guidance" TEXT,
    "absence_blocks_rental" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sku_set_component_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_unit_component_states" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "stock_unit_id" TEXT NOT NULL,
    "set_component_definition_id" TEXT NOT NULL,
    "presence" "StockUnitComponentPresence" NOT NULL DEFAULT 'PRESENT',
    "present_quantity" INTEGER NOT NULL DEFAULT 1,
    "condition" "StockConditionGrade",
    "notes" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_unit_component_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_media_attachments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "stock_unit_id" TEXT,
    "inspection_id" TEXT,
    "inspection_check_id" TEXT,
    "issue_id" TEXT,
    "service_order_id" TEXT,
    "purpose" "InventoryMediaPurpose" NOT NULL,
    "url" TEXT NOT NULL,
    "object_key" TEXT,
    "mime_type" TEXT,
    "caption" TEXT,
    "is_public_approved" BOOLEAN NOT NULL DEFAULT false,
    "uploaded_by_user_id" TEXT NOT NULL,
    "captured_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_media_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "idempotency_key" TEXT,
    "request_hash" TEXT,
    "amount" INTEGER NOT NULL,
    "rental_amount" INTEGER NOT NULL DEFAULT 0,
    "deposit_amount" INTEGER NOT NULL DEFAULT 0,
    "method" "PaymentMethod" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'pending',
    "transaction_id" TEXT,
    "provider_response" JSONB,
    "verified_at" TIMESTAMP(3),
    "refunded_at" TIMESTAMP(3),
    "refund_amount" INTEGER,
    "notes" TEXT,
    "recorded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "dedupe_key" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "next_attempt_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "failed_jobs" (
    "id" TEXT NOT NULL,
    "queue" TEXT NOT NULL,
    "job_name" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "error" TEXT NOT NULL,
    "failed_at" TIMESTAMP(3) NOT NULL,
    "retried_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "failed_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_payments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "recorded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "payment_id" TEXT,
    "invoice_no" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unpaid',
    "due_date" TIMESTAMP(3) NOT NULL,
    "paid_at" TIMESTAMP(3),
    "line_items" JSONB NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "linked_plan_id" TEXT,
    "trial_days" INTEGER,
    "discount_pct" INTEGER,
    "max_uses" INTEGER,
    "current_uses" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_history" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "old_plan_id" TEXT,
    "new_plan_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "billing_cycle" TEXT,
    "reason" TEXT,
    "performed_by" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storefront_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "product_id" TEXT,
    "variant_id" TEXT,
    "metadata" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storefront_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "colors_system_key_key" ON "colors"("system_key");

-- CreateIndex
CREATE UNIQUE INDEX "colors_name_tenant_id_key" ON "colors"("name", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_slug_key" ON "subscription_plans"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "starter_templates_template_name_key" ON "starter_templates"("template_name");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_subdomain_key" ON "tenants"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_custom_domain_key" ON "tenants"("custom_domain");

-- CreateIndex
CREATE INDEX "tenants_owner_user_id_idx" ON "tenants"("owner_user_id");

-- CreateIndex
CREATE INDEX "tenants_promo_code_id_idx" ON "tenants"("promo_code_id");

-- CreateIndex
CREATE INDEX "tenant_usage_snapshots_snapshot_date_idx" ON "tenant_usage_snapshots"("snapshot_date");

-- CreateIndex
CREATE INDEX "tenant_usage_snapshots_tenant_id_snapshot_date_idx" ON "tenant_usage_snapshots"("tenant_id", "snapshot_date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_usage_snapshots_tenant_id_snapshot_date_key" ON "tenant_usage_snapshots"("tenant_id", "snapshot_date");

-- CreateIndex
CREATE UNIQUE INDEX "store_settings_tenant_id_key" ON "store_settings"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "courier_connections_webhook_token_key" ON "courier_connections"("webhook_token");

-- CreateIndex
CREATE INDEX "courier_connections_tenant_id_is_enabled_is_default_idx" ON "courier_connections"("tenant_id", "is_enabled", "is_default");

-- CreateIndex
CREATE UNIQUE INDEX "courier_connections_tenant_id_provider_key" ON "courier_connections"("tenant_id", "provider");

-- CreateIndex
CREATE INDEX "tenant_users_user_id_idx" ON "tenant_users"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_users_tenant_id_user_id_key" ON "tenant_users"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_invitations_token_hash_key" ON "staff_invitations"("token_hash");

-- CreateIndex
CREATE INDEX "staff_invitations_tenant_id_created_at_idx" ON "staff_invitations"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "staff_invitations_tenant_id_expires_at_idx" ON "staff_invitations"("tenant_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_tenant_id_key" ON "subscriptions"("tenant_id");

-- CreateIndex
CREATE INDEX "subscriptions_plan_id_idx" ON "subscriptions"("plan_id");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_tenant_id_idx" ON "sessions"("tenant_id");

-- CreateIndex
CREATE INDEX "sessions_refresh_token_hash_idx" ON "sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "login_history_user_id_idx" ON "login_history"("user_id");

-- CreateIndex
CREATE INDEX "login_history_tenant_id_idx" ON "login_history"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_digest_key" ON "password_reset_tokens"("token_digest");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_used_at_expires_at_idx" ON "password_reset_tokens"("user_id", "used_at", "expires_at");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "products_product_type_id_idx" ON "products"("product_type_id");

-- CreateIndex
CREATE INDEX "products_size_schema_override_id_idx" ON "products"("size_schema_override_id");

-- CreateIndex
CREATE INDEX "products_tenant_id_status_idx" ON "products"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "products_tenant_id_status_popularity_score_idx" ON "products"("tenant_id", "status", "popularity_score");

-- CreateIndex
CREATE UNIQUE INDEX "products_tenant_id_slug_key" ON "products"("tenant_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_tenant_id_creation_key_key" ON "products"("tenant_id", "creation_key");

-- CreateIndex
CREATE UNIQUE INDEX "product_onboardings_product_id_key" ON "product_onboardings"("product_id");

-- CreateIndex
CREATE INDEX "product_onboardings_tenant_id_updated_at_idx" ON "product_onboardings"("tenant_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "product_onboardings_created_by_user_id_idx" ON "product_onboardings"("created_by_user_id");

-- CreateIndex
CREATE INDEX "product_onboardings_updated_by_user_id_idx" ON "product_onboardings"("updated_by_user_id");

-- CreateIndex
CREATE INDEX "product_onboarding_commands_onboarding_id_created_at_idx" ON "product_onboarding_commands"("onboarding_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "product_onboarding_commands_actor_user_id_idx" ON "product_onboarding_commands"("actor_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_onboarding_commands_tenant_id_idempotency_key_key" ON "product_onboarding_commands"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "product_variants_product_id_idx" ON "product_variants"("product_id");

-- CreateIndex
CREATE INDEX "product_variants_tenant_id_idx" ON "product_variants"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_product_id_onboarding_key_key" ON "product_variants"("product_id", "onboarding_key");

-- CreateIndex
CREATE INDEX "variant_sizes_variant_id_idx" ON "variant_sizes"("variant_id");

-- CreateIndex
CREATE INDEX "variant_sizes_tenant_id_variant_id_idx" ON "variant_sizes"("tenant_id", "variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "variant_sizes_variant_id_size_instance_id_key" ON "variant_sizes"("variant_id", "size_instance_id");

-- CreateIndex
CREATE INDEX "variant_colors_color_id_idx" ON "variant_colors"("color_id");

-- CreateIndex
CREATE UNIQUE INDEX "variant_colors_variant_id_color_id_key" ON "variant_colors"("variant_id", "color_id");

-- CreateIndex
CREATE INDEX "product_images_variant_id_idx" ON "product_images"("variant_id");

-- CreateIndex
CREATE INDEX "product_images_tenant_id_idx" ON "product_images"("tenant_id");

-- CreateIndex
CREATE INDEX "product_images_variant_id_sequence_idx" ON "product_images"("variant_id", "sequence");

-- CreateIndex
CREATE INDEX "product_detail_headers_product_id_idx" ON "product_detail_headers"("product_id");

-- CreateIndex
CREATE INDEX "product_detail_entries_header_id_idx" ON "product_detail_entries"("header_id");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_profiles_product_id_key" ON "pricing_profiles"("product_id");

-- CreateIndex
CREATE INDEX "pricing_profiles_tenant_id_idx" ON "pricing_profiles"("tenant_id");

-- CreateIndex
CREATE INDEX "pricing_profiles_tenant_id_headline_price_minor_idx" ON "pricing_profiles"("tenant_id", "headline_price_minor");

-- CreateIndex
CREATE INDEX "price_policy_versions_pricing_profile_id_status_version_idx" ON "price_policy_versions"("pricing_profile_id", "status", "version" DESC);

-- CreateIndex
CREATE INDEX "rate_plans_policy_version_id_priority_idx" ON "rate_plans"("policy_version_id", "priority" DESC);

-- CreateIndex
CREATE INDEX "price_components_policy_version_id_priority_idx" ON "price_components"("policy_version_id", "priority" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "condition_sets_rate_plan_id_key" ON "condition_sets"("rate_plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "condition_sets_component_id_key" ON "condition_sets"("component_id");

-- CreateIndex
CREATE INDEX "conditions_condition_set_id_idx" ON "conditions"("condition_set_id");

-- CreateIndex
CREATE INDEX "quotes_tenant_id_inputs_hash_idx" ON "quotes"("tenant_id", "inputs_hash");

-- CreateIndex
CREATE INDEX "quote_line_items_quote_id_idx" ON "quote_line_items"("quote_id");

-- CreateIndex
CREATE INDEX "booking_quotes_tenant_id_expires_at_idx" ON "booking_quotes"("tenant_id", "expires_at");

-- CreateIndex
CREATE INDEX "booking_quotes_tenant_id_inputs_hash_idx" ON "booking_quotes"("tenant_id", "inputs_hash");

-- CreateIndex
CREATE INDEX "storefront_checkout_quotes_tenant_id_expires_at_idx" ON "storefront_checkout_quotes"("tenant_id", "expires_at");

-- CreateIndex
CREATE INDEX "storefront_checkout_quotes_cart_id_expires_at_idx" ON "storefront_checkout_quotes"("cart_id", "expires_at");

-- CreateIndex
CREATE INDEX "storefront_checkout_quotes_tenant_id_request_hash_created_a_idx" ON "storefront_checkout_quotes"("tenant_id", "request_hash", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "storefront_carts_token_hash_key" ON "storefront_carts"("token_hash");

-- CreateIndex
CREATE INDEX "storefront_carts_tenant_id_status_expires_at_idx" ON "storefront_carts"("tenant_id", "status", "expires_at");

-- CreateIndex
CREATE INDEX "storefront_carts_tenant_id_last_activity_at_idx" ON "storefront_carts"("tenant_id", "last_activity_at" DESC);

-- CreateIndex
CREATE INDEX "storefront_cart_lines_cart_id_updated_at_idx" ON "storefront_cart_lines"("cart_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "storefront_cart_lines_product_id_variant_size_id_idx" ON "storefront_cart_lines"("product_id", "variant_size_id");

-- CreateIndex
CREATE UNIQUE INDEX "storefront_cart_lines_cart_id_line_key_key" ON "storefront_cart_lines"("cart_id", "line_key");

-- CreateIndex
CREATE INDEX "product_types_tenant_id_idx" ON "product_types"("tenant_id");

-- CreateIndex
CREATE INDEX "product_types_default_size_schema_id_idx" ON "product_types"("default_size_schema_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_types_tenant_id_slug_key" ON "product_types"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "size_schemas_tenant_id_status_idx" ON "size_schemas"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "size_schemas_tenant_id_code_key" ON "size_schemas"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "size_instances_size_schema_id_idx" ON "size_instances"("size_schema_id");

-- CreateIndex
CREATE UNIQUE INDEX "size_instances_size_schema_id_normalized_key_key" ON "size_instances"("size_schema_id", "normalized_key");

-- CreateIndex
CREATE INDEX "size_charts_tenant_id_idx" ON "size_charts"("tenant_id");

-- CreateIndex
CREATE INDEX "size_charts_size_schema_id_idx" ON "size_charts"("size_schema_id");

-- CreateIndex
CREATE INDEX "size_charts_product_id_idx" ON "size_charts"("product_id");

-- CreateIndex
CREATE INDEX "size_chart_rows_size_chart_id_sort_order_idx" ON "size_chart_rows"("size_chart_id", "sort_order");

-- CreateIndex
CREATE INDEX "categories_tenant_id_idx" ON "categories"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_tenant_id_slug_key" ON "categories"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "subcategories_category_id_idx" ON "subcategories"("category_id");

-- CreateIndex
CREATE INDEX "subcategories_tenant_id_idx" ON "subcategories"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "subcategories_category_id_slug_key" ON "subcategories"("category_id", "slug");

-- CreateIndex
CREATE INDEX "events_tenant_id_idx" ON "events"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "events_tenant_id_slug_key" ON "events"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "product_events_event_id_idx" ON "product_events"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_events_product_id_event_id_key" ON "product_events"("product_id", "event_id");

-- CreateIndex
CREATE INDEX "product_faqs_product_id_idx" ON "product_faqs"("product_id");

-- CreateIndex
CREATE INDEX "product_faqs_tenant_id_idx" ON "product_faqs"("tenant_id");

-- CreateIndex
CREATE INDEX "customers_tenant_id_status_updated_at_idx" ON "customers"("tenant_id", "status", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "customers_tenant_id_full_name_idx" ON "customers"("tenant_id", "full_name");

-- CreateIndex
CREATE INDEX "customers_merged_into_customer_id_idx" ON "customers"("merged_into_customer_id");

-- CreateIndex
CREATE INDEX "customer_identities_customer_id_kind_idx" ON "customer_identities"("customer_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "customer_identities_tenant_id_kind_normalized_value_key" ON "customer_identities"("tenant_id", "kind", "normalized_value");

-- CreateIndex
CREATE INDEX "customer_addresses_customer_id_kind_archived_at_idx" ON "customer_addresses"("customer_id", "kind", "archived_at");

-- CreateIndex
CREATE INDEX "customer_addresses_tenant_id_city_idx" ON "customer_addresses"("tenant_id", "city");

-- CreateIndex
CREATE UNIQUE INDEX "customer_tag_definitions_tenant_id_name_key" ON "customer_tag_definitions"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "customer_tag_assignments_tenant_id_tag_id_idx" ON "customer_tag_assignments"("tenant_id", "tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_tag_assignments_customer_id_tag_id_key" ON "customer_tag_assignments"("customer_id", "tag_id");

-- CreateIndex
CREATE INDEX "customer_notes_customer_id_is_pinned_created_at_idx" ON "customer_notes"("customer_id", "is_pinned", "created_at" DESC);

-- CreateIndex
CREATE INDEX "customer_consents_customer_id_purpose_recorded_at_idx" ON "customer_consents"("customer_id", "purpose", "recorded_at" DESC);

-- CreateIndex
CREATE INDEX "customer_events_customer_id_occurred_at_idx" ON "customer_events"("customer_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "customer_events_tenant_id_type_occurred_at_idx" ON "customer_events"("tenant_id", "type", "occurred_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "customer_accounts_customer_id_key" ON "customer_accounts"("customer_id");

-- CreateIndex
CREATE INDEX "customer_accounts_tenant_id_status_idx" ON "customer_accounts"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "customer_accounts_tenant_id_login_identity_id_key" ON "customer_accounts"("tenant_id", "login_identity_id");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_quote_id_key" ON "bookings"("quote_id");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_storefront_quote_id_key" ON "bookings"("storefront_quote_id");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_storefront_cart_id_key" ON "bookings"("storefront_cart_id");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_public_tracking_token_key" ON "bookings"("public_tracking_token");

-- CreateIndex
CREATE INDEX "bookings_tenant_id_status_idx" ON "bookings"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "bookings_tenant_id_created_at_idx" ON "bookings"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "bookings_customer_id_idx" ON "bookings"("customer_id");

-- CreateIndex
CREATE INDEX "bookings_tenant_id_source_location_id_rental_start_date_ren_idx" ON "bookings"("tenant_id", "source_location_id", "rental_start_date", "rental_end_date");

-- CreateIndex
CREATE INDEX "bookings_policy_version_id_idx" ON "bookings"("policy_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_tenant_id_booking_number_key" ON "bookings"("tenant_id", "booking_number");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_tenant_id_creation_key_key" ON "bookings"("tenant_id", "creation_key");

-- CreateIndex
CREATE INDEX "shipments_tenant_id_status_scheduled_pickup_at_idx" ON "shipments"("tenant_id", "status", "scheduled_pickup_at");

-- CreateIndex
CREATE INDEX "shipments_booking_id_direction_created_at_idx" ON "shipments"("booking_id", "direction", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "shipments_tenant_id_idempotency_key_key" ON "shipments"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_provider_provider_reference_key" ON "shipments"("provider", "provider_reference");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_provider_tracking_number_key" ON "shipments"("provider", "tracking_number");

-- CreateIndex
CREATE INDEX "shipment_dispatch_attempts_shipment_id_started_at_idx" ON "shipment_dispatch_attempts"("shipment_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "shipment_dispatch_attempts_tenant_id_status_started_at_idx" ON "shipment_dispatch_attempts"("tenant_id", "status", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "shipment_dispatch_attempts_tenant_id_idempotency_key_key" ON "shipment_dispatch_attempts"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "cod_remittances_shipment_id_key" ON "cod_remittances"("shipment_id");

-- CreateIndex
CREATE UNIQUE INDEX "cod_remittances_payment_id_key" ON "cod_remittances"("payment_id");

-- CreateIndex
CREATE INDEX "cod_remittances_tenant_id_status_created_at_idx" ON "cod_remittances"("tenant_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "cod_remittances_reconciled_by_id_idx" ON "cod_remittances"("reconciled_by_id");

-- CreateIndex
CREATE INDEX "shipment_items_booking_item_id_idx" ON "shipment_items"("booking_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "shipment_items_shipment_id_booking_item_id_key" ON "shipment_items"("shipment_id", "booking_item_id");

-- CreateIndex
CREATE INDEX "shipment_events_tenant_id_occurred_at_idx" ON "shipment_events"("tenant_id", "occurred_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "shipment_events_shipment_id_dedupe_key_key" ON "shipment_events"("shipment_id", "dedupe_key");

-- CreateIndex
CREATE INDEX "courier_webhook_receipts_tenant_id_received_at_idx" ON "courier_webhook_receipts"("tenant_id", "received_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "courier_webhook_receipts_provider_payload_hash_key" ON "courier_webhook_receipts"("provider", "payload_hash");

-- CreateIndex
CREATE INDEX "booking_items_booking_id_idx" ON "booking_items"("booking_id");

-- CreateIndex
CREATE INDEX "booking_items_product_id_idx" ON "booking_items"("product_id");

-- CreateIndex
CREATE INDEX "booking_items_variant_size_id_idx" ON "booking_items"("variant_size_id");

-- CreateIndex
CREATE UNIQUE INDEX "damage_reports_booking_item_id_key" ON "damage_reports"("booking_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "damage_reports_stock_unit_issue_id_key" ON "damage_reports"("stock_unit_issue_id");

-- CreateIndex
CREATE INDEX "damage_reports_tenant_id_idx" ON "damage_reports"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "deposit_settlements_booking_item_id_key" ON "deposit_settlements"("booking_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "deposit_settlements_damage_report_id_key" ON "deposit_settlements"("damage_report_id");

-- CreateIndex
CREATE INDEX "deposit_settlements_tenant_id_booking_id_created_at_idx" ON "deposit_settlements"("tenant_id", "booking_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "deposit_settlements_actor_user_id_idx" ON "deposit_settlements"("actor_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "deposit_settlements_tenant_id_idempotency_key_key" ON "deposit_settlements"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "inventory_locations_tenant_id_is_active_location_type_idx" ON "inventory_locations"("tenant_id", "is_active", "location_type");

-- CreateIndex
CREATE INDEX "inventory_locations_created_by_user_id_idx" ON "inventory_locations"("created_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_locations_tenant_id_code_key" ON "inventory_locations"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "availability_policies_tenant_id_scope_is_active_idx" ON "availability_policies"("tenant_id", "scope", "is_active");

-- CreateIndex
CREATE INDEX "availability_policies_location_id_is_active_idx" ON "availability_policies"("location_id", "is_active");

-- CreateIndex
CREATE INDEX "availability_policies_product_id_is_active_idx" ON "availability_policies"("product_id", "is_active");

-- CreateIndex
CREATE INDEX "availability_policies_variant_size_id_is_active_idx" ON "availability_policies"("variant_size_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "availability_policies_tenant_id_scope_key_key" ON "availability_policies"("tenant_id", "scope_key");

-- CreateIndex
CREATE INDEX "inventory_transfers_tenant_id_status_created_at_idx" ON "inventory_transfers"("tenant_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "inventory_transfers_origin_location_id_status_idx" ON "inventory_transfers"("origin_location_id", "status");

-- CreateIndex
CREATE INDEX "inventory_transfers_destination_location_id_status_idx" ON "inventory_transfers"("destination_location_id", "status");

-- CreateIndex
CREATE INDEX "inventory_transfers_created_by_user_id_idx" ON "inventory_transfers"("created_by_user_id");

-- CreateIndex
CREATE INDEX "inventory_transfers_approved_by_user_id_idx" ON "inventory_transfers"("approved_by_user_id");

-- CreateIndex
CREATE INDEX "inventory_transfers_dispatched_by_user_id_idx" ON "inventory_transfers"("dispatched_by_user_id");

-- CreateIndex
CREATE INDEX "inventory_transfers_received_by_user_id_idx" ON "inventory_transfers"("received_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_transfers_tenant_id_transfer_number_key" ON "inventory_transfers"("tenant_id", "transfer_number");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_transfers_tenant_id_idempotency_key_key" ON "inventory_transfers"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "inventory_transfer_lines_tenant_id_transfer_id_idx" ON "inventory_transfer_lines"("tenant_id", "transfer_id");

-- CreateIndex
CREATE INDEX "inventory_transfer_lines_variant_size_id_idx" ON "inventory_transfer_lines"("variant_size_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_transfer_lines_transfer_id_variant_size_id_key" ON "inventory_transfer_lines"("transfer_id", "variant_size_id");

-- CreateIndex
CREATE INDEX "inventory_transfer_units_tenant_id_stock_unit_id_outcome_idx" ON "inventory_transfer_units"("tenant_id", "stock_unit_id", "outcome");

-- CreateIndex
CREATE INDEX "inventory_transfer_units_stock_unit_id_idx" ON "inventory_transfer_units"("stock_unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_transfer_units_transfer_line_id_stock_unit_id_key" ON "inventory_transfer_units"("transfer_line_id", "stock_unit_id");

-- CreateIndex
CREATE INDEX "inventory_transfer_events_tenant_id_transfer_id_created_at_idx" ON "inventory_transfer_events"("tenant_id", "transfer_id", "created_at");

-- CreateIndex
CREATE INDEX "inventory_transfer_events_actor_user_id_idx" ON "inventory_transfer_events"("actor_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_transfer_events_tenant_id_idempotency_key_key" ON "inventory_transfer_events"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "stock_units_variant_size_id_idx" ON "stock_units"("variant_size_id");

-- CreateIndex
CREATE INDEX "stock_units_tenant_id_location_id_variant_size_id_idx" ON "stock_units"("tenant_id", "location_id", "variant_size_id");

-- CreateIndex
CREATE INDEX "stock_units_tenant_id_variant_size_id_disposition_operation_idx" ON "stock_units"("tenant_id", "variant_size_id", "disposition", "operational_state");

-- CreateIndex
CREATE INDEX "stock_units_tenant_id_registration_key_idx" ON "stock_units"("tenant_id", "registration_key");

-- CreateIndex
CREATE INDEX "stock_units_tenant_id_acquisition_date_idx" ON "stock_units"("tenant_id", "acquisition_date");

-- CreateIndex
CREATE UNIQUE INDEX "stock_units_tenant_id_asset_code_key" ON "stock_units"("tenant_id", "asset_code");

-- CreateIndex
CREATE UNIQUE INDEX "stock_units_tenant_id_barcode_key" ON "stock_units"("tenant_id", "barcode");

-- CreateIndex
CREATE UNIQUE INDEX "stock_units_tenant_id_registration_key_registration_row_key" ON "stock_units"("tenant_id", "registration_key", "registration_row");

-- CreateIndex
CREATE INDEX "product_composition_rules_tenant_id_parent_product_id_is_ac_idx" ON "product_composition_rules"("tenant_id", "parent_product_id", "is_active", "display_order");

-- CreateIndex
CREATE INDEX "product_composition_rules_component_product_id_idx" ON "product_composition_rules"("component_product_id");

-- CreateIndex
CREATE INDEX "product_composition_rules_fixed_variant_size_id_idx" ON "product_composition_rules"("fixed_variant_size_id");

-- CreateIndex
CREATE INDEX "product_composition_rules_created_by_user_id_idx" ON "product_composition_rules"("created_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_composition_rules_parent_product_id_name_key" ON "product_composition_rules"("parent_product_id", "name");

-- CreateIndex
CREATE INDEX "product_composition_alternatives_tenant_id_rule_id_is_activ_idx" ON "product_composition_alternatives"("tenant_id", "rule_id", "is_active", "priority");

-- CreateIndex
CREATE INDEX "product_composition_alternatives_product_id_idx" ON "product_composition_alternatives"("product_id");

-- CreateIndex
CREATE INDEX "product_composition_alternatives_variant_size_id_idx" ON "product_composition_alternatives"("variant_size_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_composition_alternatives_rule_id_product_id_variant_key" ON "product_composition_alternatives"("rule_id", "product_id", "variant_size_id");

-- CreateIndex
CREATE INDEX "fulfillment_requirements_tenant_id_booking_id_status_idx" ON "fulfillment_requirements"("tenant_id", "booking_id", "status");

-- CreateIndex
CREATE INDEX "fulfillment_requirements_tenant_id_variant_size_id_status_b_idx" ON "fulfillment_requirements"("tenant_id", "variant_size_id", "status", "blocked_start_date", "blocked_end_date");

-- CreateIndex
CREATE INDEX "fulfillment_requirements_tenant_id_source_location_id_statu_idx" ON "fulfillment_requirements"("tenant_id", "source_location_id", "status", "blocked_start_date", "blocked_end_date");

-- CreateIndex
CREATE INDEX "fulfillment_requirements_composition_rule_id_idx" ON "fulfillment_requirements"("composition_rule_id");

-- CreateIndex
CREATE INDEX "fulfillment_requirements_selected_alternative_id_idx" ON "fulfillment_requirements"("selected_alternative_id");

-- CreateIndex
CREATE INDEX "fulfillment_requirements_parent_requirement_id_idx" ON "fulfillment_requirements"("parent_requirement_id");

-- CreateIndex
CREATE UNIQUE INDEX "fulfillment_requirements_booking_item_id_requirement_key_key" ON "fulfillment_requirements"("booking_item_id", "requirement_key");

-- CreateIndex
CREATE INDEX "fulfillment_requirement_versions_tenant_id_requirement_id_c_idx" ON "fulfillment_requirement_versions"("tenant_id", "requirement_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "fulfillment_requirement_versions_actor_user_id_idx" ON "fulfillment_requirement_versions"("actor_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "fulfillment_requirement_versions_requirement_id_version_key" ON "fulfillment_requirement_versions"("requirement_id", "version");

-- CreateIndex
CREATE INDEX "fulfillment_selection_snapshots_tenant_id_booking_item_id_idx" ON "fulfillment_selection_snapshots"("tenant_id", "booking_item_id");

-- CreateIndex
CREATE INDEX "fulfillment_selection_snapshots_requirement_id_idx" ON "fulfillment_selection_snapshots"("requirement_id");

-- CreateIndex
CREATE INDEX "fulfillment_selection_snapshots_product_id_idx" ON "fulfillment_selection_snapshots"("product_id");

-- CreateIndex
CREATE INDEX "fulfillment_selection_snapshots_variant_size_id_idx" ON "fulfillment_selection_snapshots"("variant_size_id");

-- CreateIndex
CREATE UNIQUE INDEX "fulfillment_selection_snapshots_booking_item_id_composition_key" ON "fulfillment_selection_snapshots"("booking_item_id", "composition_rule_id");

-- CreateIndex
CREATE INDEX "fulfillment_substitutions_tenant_id_requirement_id_created__idx" ON "fulfillment_substitutions"("tenant_id", "requirement_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "fulfillment_substitutions_actor_user_id_idx" ON "fulfillment_substitutions"("actor_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "fulfillment_substitutions_requirement_id_to_version_key" ON "fulfillment_substitutions"("requirement_id", "to_version");

-- CreateIndex
CREATE UNIQUE INDEX "fulfillment_substitutions_tenant_id_idempotency_key_key" ON "fulfillment_substitutions"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "fulfillment_extensions_tenant_id_booking_id_created_at_idx" ON "fulfillment_extensions"("tenant_id", "booking_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "fulfillment_extensions_actor_user_id_idx" ON "fulfillment_extensions"("actor_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "fulfillment_extensions_tenant_id_idempotency_key_key" ON "fulfillment_extensions"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "fulfillment_requirement_events_tenant_id_requirement_id_cre_idx" ON "fulfillment_requirement_events"("tenant_id", "requirement_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "fulfillment_requirement_events_assignment_id_idx" ON "fulfillment_requirement_events"("assignment_id");

-- CreateIndex
CREATE INDEX "fulfillment_requirement_events_actor_user_id_idx" ON "fulfillment_requirement_events"("actor_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "fulfillment_requirement_events_tenant_id_idempotency_key_key" ON "fulfillment_requirement_events"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_reservations_fulfillment_requirement_id_key" ON "inventory_reservations"("fulfillment_requirement_id");

-- CreateIndex
CREATE INDEX "inventory_reservations_booking_id_idx" ON "inventory_reservations"("booking_id");

-- CreateIndex
CREATE INDEX "inventory_reservations_booking_item_id_idx" ON "inventory_reservations"("booking_item_id");

-- CreateIndex
CREATE INDEX "inventory_reservations_product_id_idx" ON "inventory_reservations"("product_id");

-- CreateIndex
CREATE INDEX "inventory_reservations_tenant_id_variant_size_id_status_blo_idx" ON "inventory_reservations"("tenant_id", "variant_size_id", "status", "blocked_start_date", "blocked_end_date");

-- CreateIndex
CREATE INDEX "inventory_reservations_tenant_id_source_location_id_variant_idx" ON "inventory_reservations"("tenant_id", "source_location_id", "variant_size_id", "status", "blocked_start_date", "blocked_end_date");

-- CreateIndex
CREATE INDEX "inventory_reservations_tenant_id_status_expires_at_idx" ON "inventory_reservations"("tenant_id", "status", "expires_at");

-- CreateIndex
CREATE INDEX "stock_unit_assignments_reservation_id_released_at_idx" ON "stock_unit_assignments"("reservation_id", "released_at");

-- CreateIndex
CREATE INDEX "stock_unit_assignments_tenant_id_stock_unit_id_blocked_star_idx" ON "stock_unit_assignments"("tenant_id", "stock_unit_id", "blocked_start_date", "blocked_end_date");

-- CreateIndex
CREATE INDEX "stock_unit_assignments_assigned_by_user_id_idx" ON "stock_unit_assignments"("assigned_by_user_id");

-- CreateIndex
CREATE INDEX "stock_unit_revenue_allocations_tenant_id_stock_unit_id_crea_idx" ON "stock_unit_revenue_allocations"("tenant_id", "stock_unit_id", "created_at");

-- CreateIndex
CREATE INDEX "stock_unit_revenue_allocations_tenant_id_booking_id_created_idx" ON "stock_unit_revenue_allocations"("tenant_id", "booking_id", "created_at");

-- CreateIndex
CREATE INDEX "stock_unit_revenue_allocations_booking_item_id_idx" ON "stock_unit_revenue_allocations"("booking_item_id");

-- CreateIndex
CREATE INDEX "stock_unit_revenue_allocations_fulfillment_requirement_id_idx" ON "stock_unit_revenue_allocations"("fulfillment_requirement_id");

-- CreateIndex
CREATE INDEX "stock_unit_revenue_allocations_assignment_id_idx" ON "stock_unit_revenue_allocations"("assignment_id");

-- CreateIndex
CREATE INDEX "stock_unit_revenue_allocations_actor_user_id_idx" ON "stock_unit_revenue_allocations"("actor_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_unit_revenue_allocations_tenant_id_source_key_key" ON "stock_unit_revenue_allocations"("tenant_id", "source_key");

-- CreateIndex
CREATE INDEX "inventory_movements_tenant_id_variant_size_id_created_at_idx" ON "inventory_movements"("tenant_id", "variant_size_id", "created_at");

-- CreateIndex
CREATE INDEX "inventory_movements_stock_unit_id_created_at_idx" ON "inventory_movements"("stock_unit_id", "created_at");

-- CreateIndex
CREATE INDEX "inventory_movements_transfer_id_created_at_idx" ON "inventory_movements"("transfer_id", "created_at");

-- CreateIndex
CREATE INDEX "inventory_movements_reservation_id_created_at_idx" ON "inventory_movements"("reservation_id", "created_at");

-- CreateIndex
CREATE INDEX "inventory_movements_actor_user_id_idx" ON "inventory_movements"("actor_user_id");

-- CreateIndex
CREATE INDEX "inventory_movements_count_session_id_created_at_idx" ON "inventory_movements"("count_session_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_count_sessions_tenant_id_idempotency_key_key" ON "inventory_count_sessions"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "inventory_count_sessions_tenant_id_location_id_completed_at_idx" ON "inventory_count_sessions"("tenant_id", "location_id", "completed_at" DESC);

-- CreateIndex
CREATE INDEX "inventory_count_sessions_created_by_user_id_idx" ON "inventory_count_sessions"("created_by_user_id");

-- CreateIndex
CREATE INDEX "inventory_count_sessions_completed_by_user_id_idx" ON "inventory_count_sessions"("completed_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_count_observations_count_session_id_sequence_key" ON "inventory_count_observations"("count_session_id", "sequence");

-- CreateIndex
CREATE INDEX "inventory_count_observations_tenant_id_scanned_identity_idx" ON "inventory_count_observations"("tenant_id", "scanned_identity");

-- CreateIndex
CREATE INDEX "inventory_count_observations_stock_unit_id_idx" ON "inventory_count_observations"("stock_unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_count_items_count_session_id_stock_unit_id_key" ON "inventory_count_items"("count_session_id", "stock_unit_id");

-- CreateIndex
CREATE INDEX "inventory_count_items_tenant_id_recorded_location_id_idx" ON "inventory_count_items"("tenant_id", "recorded_location_id");

-- CreateIndex
CREATE INDEX "inventory_count_items_stock_unit_id_idx" ON "inventory_count_items"("stock_unit_id");

-- CreateIndex
CREATE INDEX "inventory_blocks_tenant_id_product_id_start_date_end_date_idx" ON "inventory_blocks"("tenant_id", "product_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "inventory_blocks_tenant_id_variant_id_start_date_end_date_idx" ON "inventory_blocks"("tenant_id", "variant_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "inventory_blocks_tenant_id_variant_size_id_start_date_end_d_idx" ON "inventory_blocks"("tenant_id", "variant_size_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "inventory_blocks_tenant_id_stock_unit_id_start_date_end_dat_idx" ON "inventory_blocks"("tenant_id", "stock_unit_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "inventory_blocks_tenant_id_location_id_start_date_end_date_idx" ON "inventory_blocks"("tenant_id", "location_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "inventory_blocks_created_by_user_id_idx" ON "inventory_blocks"("created_by_user_id");

-- CreateIndex
CREATE INDEX "stock_unit_lifecycle_events_tenant_id_stock_unit_id_created_idx" ON "stock_unit_lifecycle_events"("tenant_id", "stock_unit_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "stock_unit_lifecycle_events_assignment_id_idx" ON "stock_unit_lifecycle_events"("assignment_id");

-- CreateIndex
CREATE INDEX "stock_unit_lifecycle_events_inspection_id_idx" ON "stock_unit_lifecycle_events"("inspection_id");

-- CreateIndex
CREATE INDEX "stock_unit_lifecycle_events_service_order_id_idx" ON "stock_unit_lifecycle_events"("service_order_id");

-- CreateIndex
CREATE INDEX "stock_unit_lifecycle_events_issue_id_idx" ON "stock_unit_lifecycle_events"("issue_id");

-- CreateIndex
CREATE INDEX "stock_unit_lifecycle_events_actor_user_id_idx" ON "stock_unit_lifecycle_events"("actor_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_unit_lifecycle_events_tenant_id_idempotency_key_key" ON "stock_unit_lifecycle_events"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "stock_unit_inspections_inventory_block_id_key" ON "stock_unit_inspections"("inventory_block_id");

-- CreateIndex
CREATE INDEX "stock_unit_inspections_tenant_id_stock_unit_id_created_at_idx" ON "stock_unit_inspections"("tenant_id", "stock_unit_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "stock_unit_inspections_booking_item_id_idx" ON "stock_unit_inspections"("booking_item_id");

-- CreateIndex
CREATE INDEX "stock_unit_inspections_assignment_id_idx" ON "stock_unit_inspections"("assignment_id");

-- CreateIndex
CREATE INDEX "stock_unit_inspections_service_order_id_idx" ON "stock_unit_inspections"("service_order_id");

-- CreateIndex
CREATE INDEX "stock_unit_inspections_inspected_by_user_id_idx" ON "stock_unit_inspections"("inspected_by_user_id");

-- CreateIndex
CREATE INDEX "stock_unit_inspections_amends_inspection_id_idx" ON "stock_unit_inspections"("amends_inspection_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_unit_inspections_tenant_id_create_idempotency_key_key" ON "stock_unit_inspections"("tenant_id", "create_idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "stock_unit_inspections_tenant_id_completion_idempotency_key_key" ON "stock_unit_inspections"("tenant_id", "completion_idempotency_key");

-- CreateIndex
CREATE INDEX "stock_unit_inspection_checks_tenant_id_inspection_id_idx" ON "stock_unit_inspection_checks"("tenant_id", "inspection_id");

-- CreateIndex
CREATE INDEX "stock_unit_inspection_checks_set_component_definition_id_idx" ON "stock_unit_inspection_checks"("set_component_definition_id");

-- CreateIndex
CREATE INDEX "stock_unit_issues_tenant_id_stock_unit_id_status_idx" ON "stock_unit_issues"("tenant_id", "stock_unit_id", "status");

-- CreateIndex
CREATE INDEX "stock_unit_issues_inspection_id_idx" ON "stock_unit_issues"("inspection_id");

-- CreateIndex
CREATE INDEX "stock_unit_issues_booking_item_id_idx" ON "stock_unit_issues"("booking_item_id");

-- CreateIndex
CREATE INDEX "stock_unit_issues_assignment_id_idx" ON "stock_unit_issues"("assignment_id");

-- CreateIndex
CREATE INDEX "stock_unit_issues_reported_by_user_id_idx" ON "stock_unit_issues"("reported_by_user_id");

-- CreateIndex
CREATE INDEX "stock_unit_issues_resolved_by_user_id_idx" ON "stock_unit_issues"("resolved_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_unit_issues_tenant_id_resolution_idempotency_key_key" ON "stock_unit_issues"("tenant_id", "resolution_idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_service_orders_inventory_block_id_key" ON "inventory_service_orders"("inventory_block_id");

-- CreateIndex
CREATE INDEX "inventory_service_orders_tenant_id_stock_unit_id_status_idx" ON "inventory_service_orders"("tenant_id", "stock_unit_id", "status");

-- CreateIndex
CREATE INDEX "inventory_service_orders_issue_id_idx" ON "inventory_service_orders"("issue_id");

-- CreateIndex
CREATE INDEX "inventory_service_orders_source_inspection_id_idx" ON "inventory_service_orders"("source_inspection_id");

-- CreateIndex
CREATE INDEX "inventory_service_orders_requested_by_user_id_idx" ON "inventory_service_orders"("requested_by_user_id");

-- CreateIndex
CREATE INDEX "inventory_service_orders_completed_by_user_id_idx" ON "inventory_service_orders"("completed_by_user_id");

-- CreateIndex
CREATE INDEX "inventory_service_orders_tenant_id_expected_completion_at_idx" ON "inventory_service_orders"("tenant_id", "expected_completion_at");

-- CreateIndex
CREATE INDEX "inventory_service_orders_tenant_id_service_location_id_stat_idx" ON "inventory_service_orders"("tenant_id", "service_location_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_service_orders_tenant_id_create_idempotency_key_key" ON "inventory_service_orders"("tenant_id", "create_idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_service_orders_tenant_id_completion_idempotency_k_key" ON "inventory_service_orders"("tenant_id", "completion_idempotency_key");

-- CreateIndex
CREATE INDEX "sku_set_component_definitions_tenant_id_variant_size_id_is__idx" ON "sku_set_component_definitions"("tenant_id", "variant_size_id", "is_active");

-- CreateIndex
CREATE INDEX "sku_set_component_definitions_created_by_user_id_idx" ON "sku_set_component_definitions"("created_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sku_set_component_definitions_variant_size_id_name_key" ON "sku_set_component_definitions"("variant_size_id", "name");

-- CreateIndex
CREATE INDEX "stock_unit_component_states_tenant_id_stock_unit_id_idx" ON "stock_unit_component_states"("tenant_id", "stock_unit_id");

-- CreateIndex
CREATE INDEX "stock_unit_component_states_set_component_definition_id_idx" ON "stock_unit_component_states"("set_component_definition_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_unit_component_states_stock_unit_id_set_component_def_key" ON "stock_unit_component_states"("stock_unit_id", "set_component_definition_id");

-- CreateIndex
CREATE INDEX "inventory_media_attachments_tenant_id_stock_unit_id_created_idx" ON "inventory_media_attachments"("tenant_id", "stock_unit_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "inventory_media_attachments_inspection_id_idx" ON "inventory_media_attachments"("inspection_id");

-- CreateIndex
CREATE INDEX "inventory_media_attachments_inspection_check_id_idx" ON "inventory_media_attachments"("inspection_check_id");

-- CreateIndex
CREATE INDEX "inventory_media_attachments_issue_id_idx" ON "inventory_media_attachments"("issue_id");

-- CreateIndex
CREATE INDEX "inventory_media_attachments_service_order_id_idx" ON "inventory_media_attachments"("service_order_id");

-- CreateIndex
CREATE INDEX "inventory_media_attachments_uploaded_by_user_id_idx" ON "inventory_media_attachments"("uploaded_by_user_id");

-- CreateIndex
CREATE INDEX "payments_booking_id_idx" ON "payments"("booking_id");

-- CreateIndex
CREATE INDEX "payments_tenant_id_idx" ON "payments"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_tenant_id_idempotency_key_key" ON "payments"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "payments_tenant_id_transaction_id_key" ON "payments"("tenant_id", "transaction_id");

-- CreateIndex
CREATE INDEX "reviews_product_id_idx" ON "reviews"("product_id");

-- CreateIndex
CREATE INDEX "reviews_tenant_id_idx" ON "reviews"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_booking_id_product_id_key" ON "reviews"("booking_id", "product_id");

-- CreateIndex
CREATE INDEX "notifications_tenant_id_user_id_idx" ON "notifications"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "notifications_tenant_id_is_read_idx" ON "notifications"("tenant_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_tenant_id_created_at_idx" ON "notifications"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "notification_deliveries_status_next_attempt_at_idx" ON "notification_deliveries"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "notification_deliveries_tenant_id_created_at_idx" ON "notification_deliveries"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "notification_deliveries_tenant_id_dedupe_key_key" ON "notification_deliveries"("tenant_id", "dedupe_key");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_idx" ON "audit_logs"("tenant_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "audit_logs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "failed_jobs_queue_idx" ON "failed_jobs"("queue");

-- CreateIndex
CREATE INDEX "failed_jobs_failed_at_idx" ON "failed_jobs"("failed_at");

-- CreateIndex
CREATE INDEX "subscription_payments_tenant_id_idx" ON "subscription_payments"("tenant_id");

-- CreateIndex
CREATE INDEX "subscription_payments_recorded_by_idx" ON "subscription_payments"("recorded_by");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_payment_id_key" ON "invoices"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_no_key" ON "invoices"("invoice_no");

-- CreateIndex
CREATE INDEX "invoices_tenant_id_idx" ON "invoices"("tenant_id");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes"("code");

-- CreateIndex
CREATE INDEX "subscription_history_tenant_id_idx" ON "subscription_history"("tenant_id");

-- CreateIndex
CREATE INDEX "subscription_history_tenant_id_created_at_idx" ON "subscription_history"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "storefront_events_tenant_id_event_type_created_at_idx" ON "storefront_events"("tenant_id", "event_type", "created_at");

-- CreateIndex
CREATE INDEX "storefront_events_product_id_event_type_idx" ON "storefront_events"("product_id", "event_type");

-- CreateIndex
CREATE INDEX "storefront_events_session_id_idx" ON "storefront_events"("session_id");

-- AddForeignKey
ALTER TABLE "colors" ADD CONSTRAINT "colors_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_promo_code_id_fkey" FOREIGN KEY ("promo_code_id") REFERENCES "promo_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_usage_snapshots" ADD CONSTRAINT "tenant_usage_snapshots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_settings" ADD CONSTRAINT "store_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courier_connections" ADD CONSTRAINT "courier_connections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_invitations" ADD CONSTRAINT "staff_invitations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_invitations" ADD CONSTRAINT "staff_invitations_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_history" ADD CONSTRAINT "login_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_deleted_by_user_id_fkey" FOREIGN KEY ("deleted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "subcategories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_product_type_id_fkey" FOREIGN KEY ("product_type_id") REFERENCES "product_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_size_schema_override_id_fkey" FOREIGN KEY ("size_schema_override_id") REFERENCES "size_schemas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_onboardings" ADD CONSTRAINT "product_onboardings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_onboardings" ADD CONSTRAINT "product_onboardings_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_onboardings" ADD CONSTRAINT "product_onboardings_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_onboardings" ADD CONSTRAINT "product_onboardings_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_onboarding_commands" ADD CONSTRAINT "product_onboarding_commands_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_onboarding_commands" ADD CONSTRAINT "product_onboarding_commands_onboarding_id_fkey" FOREIGN KEY ("onboarding_id") REFERENCES "product_onboardings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_onboarding_commands" ADD CONSTRAINT "product_onboarding_commands_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_main_color_id_fkey" FOREIGN KEY ("main_color_id") REFERENCES "colors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_sizes" ADD CONSTRAINT "variant_sizes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_sizes" ADD CONSTRAINT "variant_sizes_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_sizes" ADD CONSTRAINT "variant_sizes_size_instance_id_fkey" FOREIGN KEY ("size_instance_id") REFERENCES "size_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_colors" ADD CONSTRAINT "variant_colors_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_colors" ADD CONSTRAINT "variant_colors_color_id_fkey" FOREIGN KEY ("color_id") REFERENCES "colors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_detail_headers" ADD CONSTRAINT "product_detail_headers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_detail_entries" ADD CONSTRAINT "product_detail_entries_header_id_fkey" FOREIGN KEY ("header_id") REFERENCES "product_detail_headers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_profiles" ADD CONSTRAINT "pricing_profiles_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_policy_versions" ADD CONSTRAINT "price_policy_versions_pricing_profile_id_fkey" FOREIGN KEY ("pricing_profile_id") REFERENCES "pricing_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_policy_version_id_fkey" FOREIGN KEY ("policy_version_id") REFERENCES "price_policy_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_components" ADD CONSTRAINT "price_components_policy_version_id_fkey" FOREIGN KEY ("policy_version_id") REFERENCES "price_policy_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "condition_sets" ADD CONSTRAINT "condition_sets_rate_plan_id_fkey" FOREIGN KEY ("rate_plan_id") REFERENCES "rate_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "condition_sets" ADD CONSTRAINT "condition_sets_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "price_components"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditions" ADD CONSTRAINT "conditions_condition_set_id_fkey" FOREIGN KEY ("condition_set_id") REFERENCES "condition_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_policy_version_id_fkey" FOREIGN KEY ("policy_version_id") REFERENCES "price_policy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_quotes" ADD CONSTRAINT "booking_quotes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_quotes" ADD CONSTRAINT "booking_quotes_source_location_id_fkey" FOREIGN KEY ("source_location_id") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storefront_checkout_quotes" ADD CONSTRAINT "storefront_checkout_quotes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storefront_checkout_quotes" ADD CONSTRAINT "storefront_checkout_quotes_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "storefront_carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storefront_carts" ADD CONSTRAINT "storefront_carts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storefront_cart_lines" ADD CONSTRAINT "storefront_cart_lines_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "storefront_carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storefront_cart_lines" ADD CONSTRAINT "storefront_cart_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storefront_cart_lines" ADD CONSTRAINT "storefront_cart_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storefront_cart_lines" ADD CONSTRAINT "storefront_cart_lines_variant_size_id_fkey" FOREIGN KEY ("variant_size_id") REFERENCES "variant_sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_types" ADD CONSTRAINT "product_types_default_size_schema_id_fkey" FOREIGN KEY ("default_size_schema_id") REFERENCES "size_schemas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "size_instances" ADD CONSTRAINT "size_instances_size_schema_id_fkey" FOREIGN KEY ("size_schema_id") REFERENCES "size_schemas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "size_charts" ADD CONSTRAINT "size_charts_size_schema_id_fkey" FOREIGN KEY ("size_schema_id") REFERENCES "size_schemas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "size_charts" ADD CONSTRAINT "size_charts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "size_chart_rows" ADD CONSTRAINT "size_chart_rows_size_chart_id_fkey" FOREIGN KEY ("size_chart_id") REFERENCES "size_charts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcategories" ADD CONSTRAINT "subcategories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcategories" ADD CONSTRAINT "subcategories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_events" ADD CONSTRAINT "product_events_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_events" ADD CONSTRAINT "product_events_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_faqs" ADD CONSTRAINT "product_faqs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_merged_into_customer_id_fkey" FOREIGN KEY ("merged_into_customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_identities" ADD CONSTRAINT "customer_identities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_identities" ADD CONSTRAINT "customer_identities_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_tag_definitions" ADD CONSTRAINT "customer_tag_definitions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_tag_assignments" ADD CONSTRAINT "customer_tag_assignments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_tag_assignments" ADD CONSTRAINT "customer_tag_assignments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_tag_assignments" ADD CONSTRAINT "customer_tag_assignments_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "customer_tag_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_consents" ADD CONSTRAINT "customer_consents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_consents" ADD CONSTRAINT "customer_consents_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_events" ADD CONSTRAINT "customer_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_events" ADD CONSTRAINT "customer_events_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_accounts" ADD CONSTRAINT "customer_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_accounts" ADD CONSTRAINT "customer_accounts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_accounts" ADD CONSTRAINT "customer_accounts_login_identity_id_fkey" FOREIGN KEY ("login_identity_id") REFERENCES "customer_identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "booking_quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_storefront_quote_id_fkey" FOREIGN KEY ("storefront_quote_id") REFERENCES "storefront_checkout_quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_storefront_cart_id_fkey" FOREIGN KEY ("storefront_cart_id") REFERENCES "storefront_carts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_policy_version_id_fkey" FOREIGN KEY ("policy_version_id") REFERENCES "price_policy_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_source_location_id_fkey" FOREIGN KEY ("source_location_id") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_dispatch_attempts" ADD CONSTRAINT "shipment_dispatch_attempts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_dispatch_attempts" ADD CONSTRAINT "shipment_dispatch_attempts_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cod_remittances" ADD CONSTRAINT "cod_remittances_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cod_remittances" ADD CONSTRAINT "cod_remittances_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cod_remittances" ADD CONSTRAINT "cod_remittances_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cod_remittances" ADD CONSTRAINT "cod_remittances_reconciled_by_id_fkey" FOREIGN KEY ("reconciled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_booking_item_id_fkey" FOREIGN KEY ("booking_item_id") REFERENCES "booking_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courier_webhook_receipts" ADD CONSTRAINT "courier_webhook_receipts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courier_webhook_receipts" ADD CONSTRAINT "courier_webhook_receipts_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_variant_size_id_fkey" FOREIGN KEY ("variant_size_id") REFERENCES "variant_sizes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "damage_reports" ADD CONSTRAINT "damage_reports_booking_item_id_fkey" FOREIGN KEY ("booking_item_id") REFERENCES "booking_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "damage_reports" ADD CONSTRAINT "damage_reports_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "damage_reports" ADD CONSTRAINT "damage_reports_stock_unit_issue_id_fkey" FOREIGN KEY ("stock_unit_issue_id") REFERENCES "stock_unit_issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_settlements" ADD CONSTRAINT "deposit_settlements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_settlements" ADD CONSTRAINT "deposit_settlements_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_settlements" ADD CONSTRAINT "deposit_settlements_booking_item_id_fkey" FOREIGN KEY ("booking_item_id") REFERENCES "booking_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_settlements" ADD CONSTRAINT "deposit_settlements_damage_report_id_fkey" FOREIGN KEY ("damage_report_id") REFERENCES "damage_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_settlements" ADD CONSTRAINT "deposit_settlements_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_locations" ADD CONSTRAINT "inventory_locations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_locations" ADD CONSTRAINT "inventory_locations_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_policies" ADD CONSTRAINT "availability_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_policies" ADD CONSTRAINT "availability_policies_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "inventory_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_policies" ADD CONSTRAINT "availability_policies_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_policies" ADD CONSTRAINT "availability_policies_variant_size_id_fkey" FOREIGN KEY ("variant_size_id") REFERENCES "variant_sizes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_origin_location_id_fkey" FOREIGN KEY ("origin_location_id") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_destination_location_id_fkey" FOREIGN KEY ("destination_location_id") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_dispatched_by_user_id_fkey" FOREIGN KEY ("dispatched_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_received_by_user_id_fkey" FOREIGN KEY ("received_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfer_lines" ADD CONSTRAINT "inventory_transfer_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfer_lines" ADD CONSTRAINT "inventory_transfer_lines_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "inventory_transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfer_lines" ADD CONSTRAINT "inventory_transfer_lines_variant_size_id_fkey" FOREIGN KEY ("variant_size_id") REFERENCES "variant_sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfer_units" ADD CONSTRAINT "inventory_transfer_units_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfer_units" ADD CONSTRAINT "inventory_transfer_units_transfer_line_id_fkey" FOREIGN KEY ("transfer_line_id") REFERENCES "inventory_transfer_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfer_units" ADD CONSTRAINT "inventory_transfer_units_stock_unit_id_fkey" FOREIGN KEY ("stock_unit_id") REFERENCES "stock_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfer_events" ADD CONSTRAINT "inventory_transfer_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfer_events" ADD CONSTRAINT "inventory_transfer_events_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "inventory_transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfer_events" ADD CONSTRAINT "inventory_transfer_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_units" ADD CONSTRAINT "stock_units_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_units" ADD CONSTRAINT "stock_units_variant_size_id_fkey" FOREIGN KEY ("variant_size_id") REFERENCES "variant_sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_units" ADD CONSTRAINT "stock_units_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_composition_rules" ADD CONSTRAINT "product_composition_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_composition_rules" ADD CONSTRAINT "product_composition_rules_parent_product_id_fkey" FOREIGN KEY ("parent_product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_composition_rules" ADD CONSTRAINT "product_composition_rules_component_product_id_fkey" FOREIGN KEY ("component_product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_composition_rules" ADD CONSTRAINT "product_composition_rules_fixed_variant_size_id_fkey" FOREIGN KEY ("fixed_variant_size_id") REFERENCES "variant_sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_composition_rules" ADD CONSTRAINT "product_composition_rules_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_composition_alternatives" ADD CONSTRAINT "product_composition_alternatives_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_composition_alternatives" ADD CONSTRAINT "product_composition_alternatives_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "product_composition_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_composition_alternatives" ADD CONSTRAINT "product_composition_alternatives_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_composition_alternatives" ADD CONSTRAINT "product_composition_alternatives_variant_size_id_fkey" FOREIGN KEY ("variant_size_id") REFERENCES "variant_sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_requirements" ADD CONSTRAINT "fulfillment_requirements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_requirements" ADD CONSTRAINT "fulfillment_requirements_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_requirements" ADD CONSTRAINT "fulfillment_requirements_booking_item_id_fkey" FOREIGN KEY ("booking_item_id") REFERENCES "booking_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_requirements" ADD CONSTRAINT "fulfillment_requirements_composition_rule_id_fkey" FOREIGN KEY ("composition_rule_id") REFERENCES "product_composition_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_requirements" ADD CONSTRAINT "fulfillment_requirements_selected_alternative_id_fkey" FOREIGN KEY ("selected_alternative_id") REFERENCES "product_composition_alternatives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_requirements" ADD CONSTRAINT "fulfillment_requirements_parent_requirement_id_fkey" FOREIGN KEY ("parent_requirement_id") REFERENCES "fulfillment_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_requirements" ADD CONSTRAINT "fulfillment_requirements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_requirements" ADD CONSTRAINT "fulfillment_requirements_variant_size_id_fkey" FOREIGN KEY ("variant_size_id") REFERENCES "variant_sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_requirements" ADD CONSTRAINT "fulfillment_requirements_source_location_id_fkey" FOREIGN KEY ("source_location_id") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_requirement_versions" ADD CONSTRAINT "fulfillment_requirement_versions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_requirement_versions" ADD CONSTRAINT "fulfillment_requirement_versions_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "fulfillment_requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_requirement_versions" ADD CONSTRAINT "fulfillment_requirement_versions_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_selection_snapshots" ADD CONSTRAINT "fulfillment_selection_snapshots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_selection_snapshots" ADD CONSTRAINT "fulfillment_selection_snapshots_booking_item_id_fkey" FOREIGN KEY ("booking_item_id") REFERENCES "booking_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_selection_snapshots" ADD CONSTRAINT "fulfillment_selection_snapshots_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "fulfillment_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_selection_snapshots" ADD CONSTRAINT "fulfillment_selection_snapshots_composition_rule_id_fkey" FOREIGN KEY ("composition_rule_id") REFERENCES "product_composition_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_selection_snapshots" ADD CONSTRAINT "fulfillment_selection_snapshots_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_selection_snapshots" ADD CONSTRAINT "fulfillment_selection_snapshots_variant_size_id_fkey" FOREIGN KEY ("variant_size_id") REFERENCES "variant_sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_substitutions" ADD CONSTRAINT "fulfillment_substitutions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_substitutions" ADD CONSTRAINT "fulfillment_substitutions_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "fulfillment_requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_substitutions" ADD CONSTRAINT "fulfillment_substitutions_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_extensions" ADD CONSTRAINT "fulfillment_extensions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_extensions" ADD CONSTRAINT "fulfillment_extensions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_extensions" ADD CONSTRAINT "fulfillment_extensions_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_requirement_events" ADD CONSTRAINT "fulfillment_requirement_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_requirement_events" ADD CONSTRAINT "fulfillment_requirement_events_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "fulfillment_requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_requirement_events" ADD CONSTRAINT "fulfillment_requirement_events_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "stock_unit_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_requirement_events" ADD CONSTRAINT "fulfillment_requirement_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_booking_item_id_fkey" FOREIGN KEY ("booking_item_id") REFERENCES "booking_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_fulfillment_requirement_id_fkey" FOREIGN KEY ("fulfillment_requirement_id") REFERENCES "fulfillment_requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_variant_size_id_fkey" FOREIGN KEY ("variant_size_id") REFERENCES "variant_sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_source_location_id_fkey" FOREIGN KEY ("source_location_id") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_assignments" ADD CONSTRAINT "stock_unit_assignments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_assignments" ADD CONSTRAINT "stock_unit_assignments_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "inventory_reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_assignments" ADD CONSTRAINT "stock_unit_assignments_stock_unit_id_fkey" FOREIGN KEY ("stock_unit_id") REFERENCES "stock_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_assignments" ADD CONSTRAINT "stock_unit_assignments_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_revenue_allocations" ADD CONSTRAINT "stock_unit_revenue_allocations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_revenue_allocations" ADD CONSTRAINT "stock_unit_revenue_allocations_stock_unit_id_fkey" FOREIGN KEY ("stock_unit_id") REFERENCES "stock_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_revenue_allocations" ADD CONSTRAINT "stock_unit_revenue_allocations_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "stock_unit_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_revenue_allocations" ADD CONSTRAINT "stock_unit_revenue_allocations_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_revenue_allocations" ADD CONSTRAINT "stock_unit_revenue_allocations_booking_item_id_fkey" FOREIGN KEY ("booking_item_id") REFERENCES "booking_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_revenue_allocations" ADD CONSTRAINT "stock_unit_revenue_allocations_fulfillment_requirement_id_fkey" FOREIGN KEY ("fulfillment_requirement_id") REFERENCES "fulfillment_requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_revenue_allocations" ADD CONSTRAINT "stock_unit_revenue_allocations_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_variant_size_id_fkey" FOREIGN KEY ("variant_size_id") REFERENCES "variant_sizes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_stock_unit_id_fkey" FOREIGN KEY ("stock_unit_id") REFERENCES "stock_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_origin_location_id_fkey" FOREIGN KEY ("origin_location_id") REFERENCES "inventory_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_destination_location_id_fkey" FOREIGN KEY ("destination_location_id") REFERENCES "inventory_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "inventory_transfers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_transfer_line_id_fkey" FOREIGN KEY ("transfer_line_id") REFERENCES "inventory_transfer_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "inventory_reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_count_session_id_fkey" FOREIGN KEY ("count_session_id") REFERENCES "inventory_count_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_count_sessions" ADD CONSTRAINT "inventory_count_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_count_sessions" ADD CONSTRAINT "inventory_count_sessions_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_count_sessions" ADD CONSTRAINT "inventory_count_sessions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_count_sessions" ADD CONSTRAINT "inventory_count_sessions_completed_by_user_id_fkey" FOREIGN KEY ("completed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_count_observations" ADD CONSTRAINT "inventory_count_observations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_count_observations" ADD CONSTRAINT "inventory_count_observations_count_session_id_fkey" FOREIGN KEY ("count_session_id") REFERENCES "inventory_count_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_count_observations" ADD CONSTRAINT "inventory_count_observations_stock_unit_id_fkey" FOREIGN KEY ("stock_unit_id") REFERENCES "stock_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_count_items" ADD CONSTRAINT "inventory_count_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_count_items" ADD CONSTRAINT "inventory_count_items_count_session_id_fkey" FOREIGN KEY ("count_session_id") REFERENCES "inventory_count_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_count_items" ADD CONSTRAINT "inventory_count_items_stock_unit_id_fkey" FOREIGN KEY ("stock_unit_id") REFERENCES "stock_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_count_items" ADD CONSTRAINT "inventory_count_items_recorded_location_id_fkey" FOREIGN KEY ("recorded_location_id") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_blocks" ADD CONSTRAINT "inventory_blocks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_blocks" ADD CONSTRAINT "inventory_blocks_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_blocks" ADD CONSTRAINT "inventory_blocks_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_blocks" ADD CONSTRAINT "inventory_blocks_variant_size_id_fkey" FOREIGN KEY ("variant_size_id") REFERENCES "variant_sizes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_blocks" ADD CONSTRAINT "inventory_blocks_stock_unit_id_fkey" FOREIGN KEY ("stock_unit_id") REFERENCES "stock_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_blocks" ADD CONSTRAINT "inventory_blocks_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "inventory_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_blocks" ADD CONSTRAINT "inventory_blocks_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_lifecycle_events" ADD CONSTRAINT "stock_unit_lifecycle_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_lifecycle_events" ADD CONSTRAINT "stock_unit_lifecycle_events_stock_unit_id_fkey" FOREIGN KEY ("stock_unit_id") REFERENCES "stock_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_lifecycle_events" ADD CONSTRAINT "stock_unit_lifecycle_events_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "stock_unit_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_lifecycle_events" ADD CONSTRAINT "stock_unit_lifecycle_events_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "stock_unit_inspections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_lifecycle_events" ADD CONSTRAINT "stock_unit_lifecycle_events_service_order_id_fkey" FOREIGN KEY ("service_order_id") REFERENCES "inventory_service_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_lifecycle_events" ADD CONSTRAINT "stock_unit_lifecycle_events_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "stock_unit_issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_lifecycle_events" ADD CONSTRAINT "stock_unit_lifecycle_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_inspections" ADD CONSTRAINT "stock_unit_inspections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_inspections" ADD CONSTRAINT "stock_unit_inspections_stock_unit_id_fkey" FOREIGN KEY ("stock_unit_id") REFERENCES "stock_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_inspections" ADD CONSTRAINT "stock_unit_inspections_booking_item_id_fkey" FOREIGN KEY ("booking_item_id") REFERENCES "booking_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_inspections" ADD CONSTRAINT "stock_unit_inspections_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "stock_unit_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_inspections" ADD CONSTRAINT "stock_unit_inspections_service_order_id_fkey" FOREIGN KEY ("service_order_id") REFERENCES "inventory_service_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_inspections" ADD CONSTRAINT "stock_unit_inspections_inventory_block_id_fkey" FOREIGN KEY ("inventory_block_id") REFERENCES "inventory_blocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_inspections" ADD CONSTRAINT "stock_unit_inspections_inspected_by_user_id_fkey" FOREIGN KEY ("inspected_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_inspections" ADD CONSTRAINT "stock_unit_inspections_amends_inspection_id_fkey" FOREIGN KEY ("amends_inspection_id") REFERENCES "stock_unit_inspections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_inspection_checks" ADD CONSTRAINT "stock_unit_inspection_checks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_inspection_checks" ADD CONSTRAINT "stock_unit_inspection_checks_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "stock_unit_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_inspection_checks" ADD CONSTRAINT "stock_unit_inspection_checks_set_component_definition_id_fkey" FOREIGN KEY ("set_component_definition_id") REFERENCES "sku_set_component_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_issues" ADD CONSTRAINT "stock_unit_issues_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_issues" ADD CONSTRAINT "stock_unit_issues_stock_unit_id_fkey" FOREIGN KEY ("stock_unit_id") REFERENCES "stock_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_issues" ADD CONSTRAINT "stock_unit_issues_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "stock_unit_inspections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_issues" ADD CONSTRAINT "stock_unit_issues_booking_item_id_fkey" FOREIGN KEY ("booking_item_id") REFERENCES "booking_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_issues" ADD CONSTRAINT "stock_unit_issues_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "stock_unit_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_issues" ADD CONSTRAINT "stock_unit_issues_reported_by_user_id_fkey" FOREIGN KEY ("reported_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_issues" ADD CONSTRAINT "stock_unit_issues_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_service_orders" ADD CONSTRAINT "inventory_service_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_service_orders" ADD CONSTRAINT "inventory_service_orders_stock_unit_id_fkey" FOREIGN KEY ("stock_unit_id") REFERENCES "stock_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_service_orders" ADD CONSTRAINT "inventory_service_orders_service_location_id_fkey" FOREIGN KEY ("service_location_id") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_service_orders" ADD CONSTRAINT "inventory_service_orders_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "stock_unit_issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_service_orders" ADD CONSTRAINT "inventory_service_orders_source_inspection_id_fkey" FOREIGN KEY ("source_inspection_id") REFERENCES "stock_unit_inspections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_service_orders" ADD CONSTRAINT "inventory_service_orders_inventory_block_id_fkey" FOREIGN KEY ("inventory_block_id") REFERENCES "inventory_blocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_service_orders" ADD CONSTRAINT "inventory_service_orders_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_service_orders" ADD CONSTRAINT "inventory_service_orders_completed_by_user_id_fkey" FOREIGN KEY ("completed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sku_set_component_definitions" ADD CONSTRAINT "sku_set_component_definitions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sku_set_component_definitions" ADD CONSTRAINT "sku_set_component_definitions_variant_size_id_fkey" FOREIGN KEY ("variant_size_id") REFERENCES "variant_sizes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sku_set_component_definitions" ADD CONSTRAINT "sku_set_component_definitions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_component_states" ADD CONSTRAINT "stock_unit_component_states_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_component_states" ADD CONSTRAINT "stock_unit_component_states_stock_unit_id_fkey" FOREIGN KEY ("stock_unit_id") REFERENCES "stock_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_component_states" ADD CONSTRAINT "stock_unit_component_states_set_component_definition_id_fkey" FOREIGN KEY ("set_component_definition_id") REFERENCES "sku_set_component_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_media_attachments" ADD CONSTRAINT "inventory_media_attachments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_media_attachments" ADD CONSTRAINT "inventory_media_attachments_stock_unit_id_fkey" FOREIGN KEY ("stock_unit_id") REFERENCES "stock_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_media_attachments" ADD CONSTRAINT "inventory_media_attachments_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "stock_unit_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_media_attachments" ADD CONSTRAINT "inventory_media_attachments_inspection_check_id_fkey" FOREIGN KEY ("inspection_check_id") REFERENCES "stock_unit_inspection_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_media_attachments" ADD CONSTRAINT "inventory_media_attachments_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "stock_unit_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_media_attachments" ADD CONSTRAINT "inventory_media_attachments_service_order_id_fkey" FOREIGN KEY ("service_order_id") REFERENCES "inventory_service_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_media_attachments" ADD CONSTRAINT "inventory_media_attachments_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "subscription_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_linked_plan_id_fkey" FOREIGN KEY ("linked_plan_id") REFERENCES "subscription_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_old_plan_id_fkey" FOREIGN KEY ("old_plan_id") REFERENCES "subscription_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_new_plan_id_fkey" FOREIGN KEY ("new_plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storefront_events" ADD CONSTRAINT "storefront_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storefront_events" ADD CONSTRAINT "storefront_events_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PostgreSQL-only domain guarantees and operational indexes.
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE "reviews"
  ADD CONSTRAINT "reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5);

ALTER TABLE "booking_items"
  ADD CONSTRAINT "booking_items_quantity_check" CHECK ("quantity" > 0),
  ADD CONSTRAINT "booking_items_item_total_check" CHECK ("item_total" >= 0);

ALTER TABLE "products"
  ADD CONSTRAINT "products_reference_retail_value_check" CHECK (
    "reference_retail_value" IS NULL OR "reference_retail_value" >= 0
  );

ALTER TABLE "product_onboardings"
  ADD CONSTRAINT "product_onboardings_revision_check" CHECK ("revision" >= 0);

ALTER TABLE "product_onboarding_commands"
  ADD CONSTRAINT "product_onboarding_commands_revisions_check" CHECK (
    "revision_before" >= 0 AND "revision_after" = "revision_before" + 1
  );

ALTER TABLE "availability_policies"
  ADD CONSTRAINT "availability_policies_values_check" CHECK (
    "version" > 0
    AND ("preparation_buffer_minutes" IS NULL OR "preparation_buffer_minutes" >= 0)
    AND ("delivery_buffer_minutes" IS NULL OR "delivery_buffer_minutes" >= 0)
    AND ("return_buffer_minutes" IS NULL OR "return_buffer_minutes" >= 0)
    AND ("inspection_buffer_minutes" IS NULL OR "inspection_buffer_minutes" >= 0)
    AND ("cleaning_buffer_minutes" IS NULL OR "cleaning_buffer_minutes" >= 0)
    AND ("minimum_notice_minutes" IS NULL OR "minimum_notice_minutes" >= 0)
    AND ("maximum_advance_days" IS NULL OR "maximum_advance_days" > 0)
    AND ("pending_hold_minutes" IS NULL OR "pending_hold_minutes" > 0)
    AND ("shortage_limit" IS NULL OR "shortage_limit" >= 0)
    AND ("transfer_lead_time_minutes" IS NULL OR "transfer_lead_time_minutes" >= 0)
  );

ALTER TABLE "inventory_transfers"
  ADD CONSTRAINT "inventory_transfers_locations_check" CHECK ("origin_location_id" <> "destination_location_id"),
  ADD CONSTRAINT "inventory_transfers_version_check" CHECK ("version" >= 0),
  ADD CONSTRAINT "inventory_transfers_expected_dates_check" CHECK (
    "expected_dispatch_at" IS NULL
    OR "expected_arrival_at" IS NULL
    OR "expected_dispatch_at" <= "expected_arrival_at"
  );

ALTER TABLE "stock_units"
  ADD CONSTRAINT "stock_units_values_check" CHECK (
    ("acquisition_cost" IS NULL OR "acquisition_cost" >= 0)
    AND ("estimated_current_value" IS NULL OR "estimated_current_value" >= 0)
    AND "storefront_sort_order" >= 0
  );

ALTER TABLE "stock_unit_revenue_allocations"
  ADD CONSTRAINT "stock_unit_revenue_allocations_amount_check" CHECK (
    ("allocation_kind" = 'RENTAL_REVENUE' AND "amount" >= 0)
    OR ("allocation_kind" = 'ADJUSTMENT' AND "amount" <> 0)
  );

ALTER TABLE "inventory_reservations"
  ADD CONSTRAINT "inventory_reservations_quantity_check" CHECK ("quantity" > 0),
  ADD CONSTRAINT "inventory_reservations_dates_check" CHECK (
    "rental_start_date" <= "rental_end_date"
    AND "blocked_start_date" <= "rental_start_date"
    AND "blocked_end_date" >= "rental_end_date"
  );

ALTER TABLE "stock_unit_assignments"
  ADD CONSTRAINT "stock_unit_assignments_dates_check" CHECK ("blocked_start_date" <= "blocked_end_date"),
  ADD CONSTRAINT "stock_unit_assignments_no_overlap" EXCLUDE USING gist (
    "stock_unit_id" WITH =,
    daterange("blocked_start_date", "blocked_end_date", '[]') WITH &&
  ) WHERE ("released_at" IS NULL);

ALTER TABLE "inventory_blocks"
  ADD CONSTRAINT "inventory_blocks_dates_check" CHECK ("start_date" <= "end_date"),
  ADD CONSTRAINT "inventory_blocks_scope_check" CHECK (
    num_nonnulls("product_id", "variant_id", "variant_size_id", "stock_unit_id") = 1
    OR (
      num_nonnulls("product_id", "variant_id", "variant_size_id", "stock_unit_id") = 0
      AND "location_id" IS NOT NULL
    )
  );

ALTER TABLE "stock_unit_inspection_checks"
  ADD CONSTRAINT "stock_unit_inspection_checks_quantity_check" CHECK (
    "expected_quantity" > 0 AND ("observed_quantity" IS NULL OR "observed_quantity" >= 0)
  );

ALTER TABLE "stock_unit_issues"
  ADD CONSTRAINT "stock_unit_issues_cost_check" CHECK (
    ("estimated_cost" IS NULL OR "estimated_cost" >= 0)
    AND ("customer_charge" IS NULL OR "customer_charge" >= 0)
  );

ALTER TABLE "inventory_service_orders"
  ADD CONSTRAINT "inventory_service_orders_cost_check" CHECK ("cost" IS NULL OR "cost" >= 0),
  ADD CONSTRAINT "inventory_service_orders_dates_check" CHECK (
    ("scheduled_start_at" IS NULL OR "expected_completion_at" IS NULL OR "scheduled_start_at" <= "expected_completion_at")
    AND ("started_at" IS NULL OR "completed_at" IS NULL OR "started_at" <= "completed_at")
  );

ALTER TABLE "sku_set_component_definitions"
  ADD CONSTRAINT "sku_set_component_definitions_quantity_check" CHECK ("required_quantity" > 0);

ALTER TABLE "stock_unit_component_states"
  ADD CONSTRAINT "stock_unit_component_states_quantity_check" CHECK ("present_quantity" >= 0);

ALTER TABLE "stock_unit_inspections"
  ADD CONSTRAINT "stock_unit_inspections_completion_check" CHECK (
    ("status" = 'DRAFT' AND "completed_at" IS NULL)
    OR (
      "status" IN ('COMPLETED', 'SUPERSEDED')
      AND "completed_at" IS NOT NULL
      AND "condition_after" IS NOT NULL
      AND "decision" IS NOT NULL
    )
  );

ALTER TABLE "inventory_media_attachments"
  ADD CONSTRAINT "inventory_media_attachments_one_parent_check" CHECK (
    num_nonnulls("stock_unit_id", "inspection_id", "inspection_check_id", "issue_id", "service_order_id") = 1
  );

ALTER TABLE "product_composition_rules"
  ADD CONSTRAINT "product_composition_rules_quantity_check" CHECK ("quantity" > 0),
  ADD CONSTRAINT "product_composition_rules_allocation_weight_check" CHECK ("allocation_weight" > 0),
  ADD CONSTRAINT "product_composition_rules_fixed_sku_check" CHECK (
    "sku_resolution" <> 'FIXED' OR "fixed_variant_size_id" IS NOT NULL
  );

ALTER TABLE "fulfillment_requirements"
  ADD CONSTRAINT "fulfillment_requirements_quantity_check" CHECK ("quantity" > 0),
  ADD CONSTRAINT "fulfillment_requirements_counters_check" CHECK (
    "assigned_quantity" BETWEEN 0 AND "quantity"
    AND "handed_out_quantity" BETWEEN 0 AND "quantity"
    AND "returned_quantity" >= 0
    AND "lost_quantity" >= 0
    AND "returned_quantity" + "lost_quantity" <= "handed_out_quantity"
  ),
  ADD CONSTRAINT "fulfillment_requirements_dates_check" CHECK (
    "rental_start_date" <= "rental_end_date"
    AND "blocked_start_date" <= "rental_start_date"
    AND "blocked_end_date" >= "rental_end_date"
  );

ALTER TABLE "fulfillment_requirement_versions"
  ADD CONSTRAINT "fulfillment_requirement_versions_quantity_check" CHECK ("quantity" > 0),
  ADD CONSTRAINT "fulfillment_requirement_versions_dates_check" CHECK (
    "rental_start_date" <= "rental_end_date"
    AND "blocked_start_date" <= "rental_start_date"
    AND "blocked_end_date" >= "rental_end_date"
  );

ALTER TABLE "fulfillment_selection_snapshots"
  ADD CONSTRAINT "fulfillment_selection_snapshots_quantity_check" CHECK ("quantity" > 0);

ALTER TABLE "fulfillment_requirement_events"
  ADD CONSTRAINT "fulfillment_requirement_events_quantity_check" CHECK ("quantity" > 0);

CREATE UNIQUE INDEX "inventory_service_orders_one_blocking_active_per_unit"
  ON "inventory_service_orders"("tenant_id", "stock_unit_id")
  WHERE "is_availability_blocking" = true AND "status" IN ('REQUESTED', 'SCHEDULED', 'IN_PROGRESS');

CREATE OR REPLACE FUNCTION products_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_search_vector_trigger
  BEFORE INSERT OR UPDATE OF name, description ON products
  FOR EACH ROW
  EXECUTE FUNCTION products_search_vector_update();

CREATE INDEX "products_search_idx" ON "products" USING gin("search_vector");
CREATE INDEX "products_trgm_idx" ON "products" USING gin("name" gin_trgm_ops);
CREATE INDEX "products_storefront_idx" ON "products"("tenant_id", "created_at" DESC)
  WHERE "status" = 'published' AND "is_available" = true AND "deleted_at" IS NULL;
CREATE INDEX "bookings_active_idx" ON "bookings"("tenant_id", "created_at" DESC)
  WHERE "deleted_at" IS NULL;
