-- 004 test setup: demo accounts, so the demo organiser exists before 003_seed runs.
-- Test only. Never run on Supabase. Runs before 003_seed.sql (second run) and 004_inventory.test.sql.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'demo.organiser@example.com'),
  ('00000000-0000-0000-0000-0000000000a2', 'demo.attendee@example.com'),
  ('00000000-0000-0000-0000-0000000000a3', 'other.buyer@example.com');
INSERT INTO user_emails (user_id, email, email_key, verified_at) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'demo.organiser@example.com', 'demo.organiser@example.com', now()),
  ('00000000-0000-0000-0000-0000000000a2', 'demo.attendee@example.com', 'demo.attendee@example.com', now()),
  ('00000000-0000-0000-0000-0000000000a3', 'other.buyer@example.com', 'other.buyer@example.com', now());
