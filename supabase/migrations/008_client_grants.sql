-- 008 client grants (PHASE2_PLAN §2.10).
-- Supabase gives anon and authenticated ALL privileges on public tables by default. TRUNCATE skips RLS,
-- so clients must not have it. RLS already blocks row writes (see 010 T88); this removes the TRUNCATE path.
-- Applies to existing tables and to tables created later.
-- DEV ONLY until the user says otherwise. Do not run on production (ccqbubgebsayoviilnul).

REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE ON TABLES FROM anon, authenticated;
