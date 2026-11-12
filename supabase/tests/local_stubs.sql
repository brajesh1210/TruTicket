-- ============================================================================
-- local_stubs.sql — ONLY for plain Postgres (Docker or local install).
-- Supabase already has all of this. Do NOT run on a Supabase project.
-- Recreates the parts of Supabase that the migrations rely on:
--   roles anon / authenticated / service_role, the auth schema with
--   auth.users and auth.uid(), and Supabase's default grants on public.
-- Run this first, then 001_init.sql, then 002_auth_sessions.sql.
-- ============================================================================

DO $$ BEGIN CREATE ROLE anon NOLOGIN;          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS auth.users (
  id    uuid PRIMARY KEY,
  email text UNIQUE
);
GRANT SELECT ON auth.users TO authenticated, service_role;

-- Same contract as Supabase: reads the JWT claims set per request.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid;
$$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
-- Supabase's default: new public tables and functions are open to all roles.
-- RLS and the REVOKEs in 002 are what protect them.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

-- ---- Added for 002b (session guard) ----
-- auth.sessions: one row per Supabase login session. Deleting a row also removes
-- its refresh tokens in Supabase (here the cascade is only modelled by the row).
CREATE TABLE IF NOT EXISTS auth.sessions (
  id         uuid PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  not_after  timestamptz
);

-- Same contract as Supabase: the verified access-token claims for this request.
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;
