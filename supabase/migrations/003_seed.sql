-- TruTicket 003: demo event and inventory (PHASE2_PLAN §2.5). Safe to run twice.
-- Needs the demo organiser to have signed in once (email code), because accounts are created at sign-in.
-- If the demo organiser does not exist yet, this file prints a NOTICE and creates nothing.

DO $$
DECLARE
  v_org_user uuid;
  v_organizer uuid;
  v_event uuid;
BEGIN
  SELECT e.user_id INTO v_org_user
    FROM user_emails e
   WHERE e.email_key = 'demo.organiser@example.com'
     AND e.verified_at IS NOT NULL
   LIMIT 1;

  IF v_org_user IS NULL THEN
    RAISE NOTICE '003_seed: demo organiser not found. Sign in once with demo.organiser@example.com, then run this file again.';
    RETURN;
  END IF;

  -- Organiser row (needs a profiles row; created by the 002 trigger at sign-in).
  INSERT INTO organizers ("userId", "organizationName", "verificationStatus")
  VALUES (v_org_user, 'TruTicket Demo Events', 'verified')
  ON CONFLICT ("userId") DO NOTHING;
  SELECT id INTO v_organizer FROM organizers WHERE "userId" = v_org_user;

  -- Demo event (already published, so it appears to attendees).
  SELECT id INTO v_event FROM events WHERE title = 'TruTicket Demo Night' AND "organizerId" = v_organizer;
  IF v_event IS NULL THEN
    INSERT INTO events ("organizerId", title, description, venue, "startAt", "endAt", categories, status)
    VALUES (
      v_organizer,
      'TruTicket Demo Night',
      'Demo event for testing purchase to entry. Not a real event.',
      'Demo Hall, New Delhi',
      now() + interval '30 days',
      now() + interval '30 days' + interval '4 hours',
      ARRAY['demo', 'music'],
      'published'
    )
    RETURNING id INTO v_event;
  END IF;

  -- Three ticket types (prices in paise: 49900 = Rs 499).
  INSERT INTO ticket_types ("eventId", name, "faceValueMinor", currency, quantity, "saleStart", "saleEnd", "perAccountLimit")
  SELECT v_event, t.name, t.price, 'INR', t.qty, now() - interval '1 day', now() + interval '29 days', 4
    FROM (VALUES ('General', 49900, 200), ('VIP', 149900, 50), ('Student', 19900, 100)) AS t(name, price, qty)
   WHERE NOT EXISTS (SELECT 1 FROM ticket_types x WHERE x."eventId" = v_event AND x.name = t.name);

  -- One demo gate scanner.
  INSERT INTO scanners ("eventId", "deviceName", status)
  SELECT v_event, 'Demo gate scanner', 'active'
   WHERE NOT EXISTS (SELECT 1 FROM scanners s WHERE s."eventId" = v_event AND s."deviceName" = 'Demo gate scanner');

  RAISE NOTICE '003_seed: demo event % ready', v_event;
END $$;
