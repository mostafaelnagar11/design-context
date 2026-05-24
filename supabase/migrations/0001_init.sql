-- Design Context — initial schema
-- Mirrors PRD §11. Uses Supabase Auth (auth.users) as identity source.

create extension if not exists "pgcrypto";

-- ──────────────────────────────────────────────────────────────
-- users (application profile, 1-1 with auth.users)
-- ──────────────────────────────────────────────────────────────
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  hashed_api_key text unique,
  created_at timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────────────
-- design_systems
-- ──────────────────────────────────────────────────────────────
create type public.system_status as enum ('draft', 'published');

create table public.design_systems (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  slug text not null,
  status public.system_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);

create index design_systems_user_id_idx on public.design_systems(user_id);
create index design_systems_user_status_idx
  on public.design_systems(user_id, status);

-- ──────────────────────────────────────────────────────────────
-- tokens
-- ──────────────────────────────────────────────────────────────
create type public.token_category as enum
  ('color', 'typography', 'spacing', 'radii', 'shadow');

create table public.tokens (
  id uuid primary key default gen_random_uuid(),
  system_id uuid not null references public.design_systems(id) on delete cascade,
  category public.token_category not null,
  group_name text,
  token_name text not null,
  token_value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tokens_system_idx on public.tokens(system_id);
create index tokens_system_category_idx on public.tokens(system_id, category);

-- ──────────────────────────────────────────────────────────────
-- updated_at trigger
-- ──────────────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger design_systems_touch
  before update on public.design_systems
  for each row execute function public.touch_updated_at();

create trigger tokens_touch
  before update on public.tokens
  for each row execute function public.touch_updated_at();

-- ──────────────────────────────────────────────────────────────
-- Row Level Security
-- ──────────────────────────────────────────────────────────────
alter table public.users enable row level security;
alter table public.design_systems enable row level security;
alter table public.tokens enable row level security;

-- users: a user can read/update only their own profile row.
-- Inserts happen via service-role (signup handler) so no insert policy.
create policy users_select_self on public.users
  for select using (id = auth.uid());

create policy users_update_self on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());

-- design_systems: full CRUD scoped to owner
create policy design_systems_select_own on public.design_systems
  for select using (user_id = auth.uid());

create policy design_systems_insert_own on public.design_systems
  for insert with check (user_id = auth.uid());

create policy design_systems_update_own on public.design_systems
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy design_systems_delete_own on public.design_systems
  for delete using (user_id = auth.uid());

-- tokens: scoped through parent design_system ownership
create policy tokens_select_own on public.tokens
  for select using (
    exists (
      select 1 from public.design_systems s
      where s.id = tokens.system_id and s.user_id = auth.uid()
    )
  );

create policy tokens_insert_own on public.tokens
  for insert with check (
    exists (
      select 1 from public.design_systems s
      where s.id = tokens.system_id and s.user_id = auth.uid()
    )
  );

create policy tokens_update_own on public.tokens
  for update using (
    exists (
      select 1 from public.design_systems s
      where s.id = tokens.system_id and s.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.design_systems s
      where s.id = tokens.system_id and s.user_id = auth.uid()
    )
  );

create policy tokens_delete_own on public.tokens
  for delete using (
    exists (
      select 1 from public.design_systems s
      where s.id = tokens.system_id and s.user_id = auth.uid()
    )
  );
