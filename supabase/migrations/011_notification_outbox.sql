-- 011: notification outbox for n8n (PHASE2_PLAN Phase 5). Service role only.
-- n8n inserts one row per notification (dedupeKey makes the insert idempotent), sends the email,
-- then marks the row SENT or FAILED. No client can read or write this table.

CREATE TABLE IF NOT EXISTS notification_outbox (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         text NOT NULL CHECK (kind IN (
                 'PAYMENT_CONFIRMED', 'EVENT_PUBLISHED', 'RESALE_OFFER', 'QR_EXPIRY_WARNING',
                 'TICKET_REDEEMED', 'PAYMENT_CLEANUP', 'GROUP_INVITE')),
  "dedupeKey"  text NOT NULL UNIQUE,
  "recipientId" uuid REFERENCES profiles(id) ON DELETE CASCADE,
  payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
  status       text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
  attempts     integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  "lastError"  text,
  "createdAt"  timestamptz(3) NOT NULL DEFAULT now(),
  "sentAt"     timestamptz(3)
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending ON notification_outbox (status, "createdAt")
  WHERE status = 'PENDING';

ALTER TABLE notification_outbox ENABLE ROW LEVEL SECURITY;
-- No policies: RLS already hides every row from clients. Grants are removed as well (defence in depth).
REVOKE ALL ON notification_outbox FROM anon, authenticated;
