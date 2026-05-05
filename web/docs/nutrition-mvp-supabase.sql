-- Nutrition MVP Supabase prototype schema
-- Note: this is intentionally MVP-first. It assumes client-side access with anon key.
-- For a production launch, add proper auth + RLS policies keyed by auth.uid().

create table if not exists public.nutrition_profiles (
  email text primary key,
  goal text not null,
  calorie_target integer not null,
  protein_target integer not null,
  carb_target integer not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.nutrition_logs (
  id text primary key,
  user_email text not null,
  meal_type text not null,
  food jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null default now()
);
create index if not exists nutrition_logs_user_email_idx on public.nutrition_logs (user_email, created_at desc);

create table if not exists public.nutrition_custom_foods (
  id text primary key,
  user_email text not null,
  food jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists nutrition_custom_foods_user_email_idx on public.nutrition_custom_foods (user_email, created_at desc);

create table if not exists public.nutrition_recent_searches (
  user_email text primary key,
  searches jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Prototype only: disable RLS so the frontend anon key can read/write.
-- Replace this with real auth policies before public launch.
alter table public.nutrition_profiles disable row level security;
alter table public.nutrition_logs disable row level security;
alter table public.nutrition_custom_foods disable row level security;
alter table public.nutrition_recent_searches disable row level security;
