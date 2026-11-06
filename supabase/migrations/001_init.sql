-- ============================================================================
-- TruTicket — 001_init.sql
-- Creates all Prisma-mapped tables (18 models) in dependency order.
-- Column names match prisma/schema.prisma exactly (camelCase, quoted).
-- Safe to re-run: uses IF NOT EXISTS / DROP POLICY IF EXISTS.
-- Run the WHOLE file in one go in Supabase SQL Editor.
-- ============================================================================

-- ---------- 1. ENUM TYPES (names match Prisma enums) ----------
DO $$ BEGIN CREATE TYPE "UserRole" AS ENUM ('ATTENDEE','ORGANIZER','GATE_STAFF','FRAUD_REVIEWER','PLATFORM_ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "TicketStatus" AS ENUM ('CREATED','AVAILABLE','ISSUED_ACTIVE','ISSUED_UNASSIGNED_GROUP','LISTED','TRANSFERRED','REDEEMED','REVOKED','CANCELLED','REFUNDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "OrderStatus" AS ENUM ('CREATED','RESERVED','PAYMENT_PENDING','PAID','TICKET_ISSUED','PAYMENT_FAILED','RESERVATION_EXPIRED','CANCELLED','REFUND_PENDING','REFUNDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "ResaleListingStatus" AS ENUM ('DRAFT','ACTIVE','PURCHASE_PENDING','TRANSFER_PENDING','COMPLETED','CANCELLED','EXPIRED','PAYMENT_FAILED','TRANSFER_FAILED','DISPUTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "QueueAllocationStatus" AS ENUM ('JOINED','SELECTED','ADMITTED','EXPIRED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "RiskBand" AS ENUM ('LOW','MEDIUM','HIGH');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- 2. TABLES (parents first, children after) ----------

-- profiles (no FK dependencies)
CREATE TABLE IF NOT EXISTS profiles (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL UNIQUE,
  phone          text,
  "passwordHash" text,
  role           "UserRole" NOT NULL DEFAULT 'ATTENDEE',
  status         text NOT NULL DEFAULT 'active',
  "createdAt"    timestamptz(3) NOT NULL DEFAULT now(),
  "updatedAt"    timestamptz(3) NOT NULL DEFAULT now()
);

-- organizers -> profiles
CREATE TABLE IF NOT EXISTS organizers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"            uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  "organizationName"  text NOT NULL,
  "verificationStatus" text NOT NULL DEFAULT 'pending',
  "createdAt"         timestamptz(3) NOT NULL DEFAULT now()
);

-- events -> organizers
CREATE TABLE IF NOT EXISTS events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizerId"   uuid NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  venue           text NOT NULL,
  timezone        text NOT NULL DEFAULT 'Asia/Kolkata',
  "startAt"       timestamptz(3) NOT NULL,
  "endAt"         timestamptz(3) NOT NULL,
  "coverImageUrl" text,
  categories      text[] NOT NULL DEFAULT '{}',
  terms           text,
  status          text NOT NULL DEFAULT 'draft',
  "contractAddress" text,
  "chainId"       integer,
  "createdAt"     timestamptz(3) NOT NULL DEFAULT now(),
  "updatedAt"     timestamptz(3) NOT NULL DEFAULT now()
);

-- ticket_types -> events
CREATE TABLE IF NOT EXISTS ticket_types (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "eventId"         uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name              text NOT NULL,
  "faceValueMinor"  integer NOT NULL,
  currency          text NOT NULL DEFAULT 'INR',
  quantity          integer NOT NULL,
  "saleStart"       timestamptz(3) NOT NULL,
  "saleEnd"         timestamptz(3) NOT NULL,
  "perAccountLimit" integer NOT NULL DEFAULT 4,
  "refundRules"     text,
  "createdAt"       timestamptz(3) NOT NULL DEFAULT now()
);

-- scanners -> events   (MUST be before redemptions)
CREATE TABLE IF NOT EXISTS scanners (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "eventId"         uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  "deviceName"      text NOT NULL,
  "publicKey"       text,
  "deviceSecretRef" text,
  status            text NOT NULL DEFAULT 'active',
  "createdAt"       timestamptz(3) NOT NULL DEFAULT now()
);

-- tickets -> events, ticket_types, profiles
CREATE TABLE IF NOT EXISTS tickets (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "eventId"        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  "ticketTypeId"   uuid NOT NULL REFERENCES ticket_types(id) ON DELETE CASCADE,
  "tokenId"        text,
  "currentOwnerId" uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  "faceValueMinor" integer NOT NULL,
  status           "TicketStatus" NOT NULL DEFAULT 'CREATED',
  "transferCount"  integer NOT NULL DEFAULT 0,
  "policyVersion"  integer NOT NULL DEFAULT 1,
  "createdAt"      timestamptz(3) NOT NULL DEFAULT now(),
  "updatedAt"      timestamptz(3) NOT NULL DEFAULT now()
);

-- orders -> profiles, events
CREATE TABLE IF NOT EXISTS orders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "buyerId"        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  "eventId"        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  status           "OrderStatus" NOT NULL DEFAULT 'CREATED',
  "totalMinor"     integer NOT NULL,
  currency         text NOT NULL DEFAULT 'INR',
  "idempotencyKey" text NOT NULL UNIQUE,
  "createdAt"      timestamptz(3) NOT NULL DEFAULT now(),
  "updatedAt"      timestamptz(3) NOT NULL DEFAULT now()
);

-- order_items -> orders, ticket_types, tickets
CREATE TABLE IF NOT EXISTS order_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId"        uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  "ticketTypeId"   uuid NOT NULL REFERENCES ticket_types(id) ON DELETE CASCADE,
  "ticketId"       uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  "unitPriceMinor" integer NOT NULL
);

-- payments -> orders
CREATE TABLE IF NOT EXISTS payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId"           uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider            text NOT NULL DEFAULT 'razorpay',
  "providerPaymentId" text,
  status              text NOT NULL DEFAULT 'pending',
  "signatureVerified" boolean NOT NULL DEFAULT false,
  "createdAt"         timestamptz(3) NOT NULL DEFAULT now(),
  "updatedAt"         timestamptz(3) NOT NULL DEFAULT now()
);

-- inventory_reservations -> events, ticket_types, profiles
CREATE TABLE IF NOT EXISTS inventory_reservations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "eventId"      uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  "ticketTypeId" uuid NOT NULL REFERENCES ticket_types(id) ON DELETE CASCADE,
  "userId"       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  quantity       integer NOT NULL,
  "expiresAt"    timestamptz(3) NOT NULL,
  status         text NOT NULL DEFAULT 'active'
);

-- queue_entries -> events, profiles
CREATE TABLE IF NOT EXISTS queue_entries (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "eventId"          uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  "userId"           uuid REFERENCES profiles(id) ON DELETE SET NULL,
  "sessionId"        text,
  "joinedAt"         timestamptz(3) NOT NULL DEFAULT now(),
  "allocationStatus" "QueueAllocationStatus" NOT NULL DEFAULT 'JOINED',
  "admissionExpiresAt" timestamptz(3),
  "createdAt"        timestamptz(3) NOT NULL DEFAULT now()
);

-- resale_listings -> tickets, profiles
CREATE TABLE IF NOT EXISTS resale_listings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticketId"  uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  "sellerId"  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  "askMinor"  integer NOT NULL,
  status      "ResaleListingStatus" NOT NULL DEFAULT 'DRAFT',
  "expiresAt" timestamptz(3),
  "createdAt" timestamptz(3) NOT NULL DEFAULT now(),
  "updatedAt" timestamptz(3) NOT NULL DEFAULT now()
);

-- transfers -> tickets, profiles
CREATE TABLE IF NOT EXISTS transfers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticketId"    uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  "fromOwnerId" uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  "toOwnerId"   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  "priceMinor"  integer NOT NULL,
  "txHash"      text,
  status        text NOT NULL DEFAULT 'pending',
  "createdAt"   timestamptz(3) NOT NULL DEFAULT now()
);

-- qr_credentials -> tickets
CREATE TABLE IF NOT EXISTS qr_credentials (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticketId"   uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  "nonceHash"  text NOT NULL,
  "expiresAt"  timestamptz(3) NOT NULL,
  "keyId"      text NOT NULL,
  "consumedAt" timestamptz(3),
  status       text NOT NULL DEFAULT 'active',
  "createdAt"  timestamptz(3) NOT NULL DEFAULT now()
);

-- redemptions -> tickets, events, scanners  (scanners already created above)
CREATE TABLE IF NOT EXISTS redemptions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticketId"       uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  "eventId"        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  "scannerId"      uuid NOT NULL REFERENCES scanners(id) ON DELETE CASCADE,
  "redeemedAt"     timestamptz(3) NOT NULL DEFAULT now(),
  result           text NOT NULL,
  "idempotencyKey" text NOT NULL UNIQUE
);

-- audit_logs -> profiles
CREATE TABLE IF NOT EXISTS audit_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "actorId"    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action       text NOT NULL,
  "objectType" text NOT NULL,
  "objectId"   text,
  outcome      text NOT NULL,
  "timestamp"  timestamptz(3) NOT NULL DEFAULT now()
);

-- fraud_events -> profiles
CREATE TABLE IF NOT EXISTS fraud_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "sessionId"   text NOT NULL UNIQUE,
  "userId"      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  "riskScore"   integer NOT NULL DEFAULT 0,
  "riskBand"    "RiskBand" NOT NULL DEFAULT 'LOW',
  "reasonCodes" text[] NOT NULL DEFAULT '{}',
  status        text NOT NULL DEFAULT 'open',
  "reviewedBy"  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  "reviewedAt"  timestamptz(3),
  "createdAt"   timestamptz(3) NOT NULL DEFAULT now()
);

-- group_tickets -> orders, profiles, tickets
CREATE TABLE IF NOT EXISTS group_tickets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId"       uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  "managerId"     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  "memberId"      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  "ticketId"      uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'unassigned',
  "claimToken"    text,
  "inviteExpiresAt" timestamptz(3),
  "createdAt"     timestamptz(3) NOT NULL DEFAULT now(),
  "updatedAt"     timestamptz(3) NOT NULL DEFAULT now()
);

-- ---------- 3. INDEXES on foreign keys (fast lookups, scanner/gate speed) ----------
CREATE INDEX IF NOT EXISTS idx_organizers_user        ON organizers("userId");
CREATE INDEX IF NOT EXISTS idx_events_organizer       ON events("organizerId");
CREATE INDEX IF NOT EXISTS idx_ticket_types_event     ON ticket_types("eventId");
CREATE INDEX IF NOT EXISTS idx_scanners_event         ON scanners("eventId");
CREATE INDEX IF NOT EXISTS idx_tickets_event          ON tickets("eventId");
CREATE INDEX IF NOT EXISTS idx_tickets_owner          ON tickets("currentOwnerId");
CREATE INDEX IF NOT EXISTS idx_tickets_type           ON tickets("ticketTypeId");
CREATE INDEX IF NOT EXISTS idx_orders_buyer           ON orders("buyerId");
CREATE INDEX IF NOT EXISTS idx_orders_event           ON orders("eventId");
CREATE INDEX IF NOT EXISTS idx_order_items_order      ON order_items("orderId");
CREATE INDEX IF NOT EXISTS idx_payments_order         ON payments("orderId");
CREATE INDEX IF NOT EXISTS idx_reservations_event     ON inventory_reservations("eventId");
CREATE INDEX IF NOT EXISTS idx_queue_event            ON queue_entries("eventId");
CREATE INDEX IF NOT EXISTS idx_resale_ticket          ON resale_listings("ticketId");
CREATE INDEX IF NOT EXISTS idx_transfers_ticket       ON transfers("ticketId");
CREATE INDEX IF NOT EXISTS idx_qr_ticket              ON qr_credentials("ticketId");
CREATE INDEX IF NOT EXISTS idx_redemptions_ticket     ON redemptions("ticketId");
CREATE INDEX IF NOT EXISTS idx_redemptions_event      ON redemptions("eventId");
CREATE INDEX IF NOT EXISTS idx_audit_actor            ON audit_logs("actorId");
CREATE INDEX IF NOT EXISTS idx_group_tickets_order    ON group_tickets("orderId");
CREATE INDEX IF NOT EXISTS idx_group_tickets_manager  ON group_tickets("managerId");

-- ---------- 4. ROW LEVEL SECURITY ----------
-- Enable RLS on every table. Mobile/web clients (anon/authenticated keys)
-- can only touch what the policies below allow. Everything else is
-- accessed server-side via Edge Functions using the service_role key.
ALTER TABLE profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE events                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_types           ENABLE ROW LEVEL SECURITY;
ALTER TABLE scanners               ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets                ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_entries          ENABLE ROW LEVEL SECURITY;
ALTER TABLE resale_listings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_credentials         ENABLE ROW LEVEL SECURITY;
ALTER TABLE redemptions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_tickets          ENABLE ROW LEVEL SECURITY;

-- profiles: a user can read and update only their own row
DROP POLICY IF EXISTS profiles_self_select ON profiles;
CREATE POLICY profiles_self_select ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS profiles_self_update ON profiles;
CREATE POLICY profiles_self_update ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- events: public can read published events only
DROP POLICY IF EXISTS events_public_read ON events;
CREATE POLICY events_public_read ON events FOR SELECT TO anon, authenticated
  USING (status = 'published');

-- ticket_types: public can read types belonging to published events
DROP POLICY IF EXISTS ticket_types_public_read ON ticket_types;
CREATE POLICY ticket_types_public_read ON ticket_types FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM events e WHERE e.id = ticket_types."eventId" AND e.status = 'published'));

-- tickets: owner can see their own tickets
DROP POLICY IF EXISTS tickets_owner_read ON tickets;
CREATE POLICY tickets_owner_read ON tickets FOR SELECT TO authenticated
  USING ("currentOwnerId" = auth.uid());

-- orders: buyer can see their own orders
DROP POLICY IF EXISTS orders_buyer_read ON orders;
CREATE POLICY orders_buyer_read ON orders FOR SELECT TO authenticated
  USING ("buyerId" = auth.uid());

-- All other tables: RLS enabled with NO policy => denied to clients.
-- (payments, scanners, redemptions, qr_credentials, fraud_events, audit_logs,
--  transfers, resale_listings, queue_entries, inventory_reservations, group_tickets, ...)
