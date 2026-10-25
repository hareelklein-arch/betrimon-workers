-- Production schema for Supabase Postgres.
-- Apply in the SQL editor after creating the project in eu-central-1.
-- Local development uses Prisma + SQLite with the same logical model.

create table if not exists public.users (
  id text primary key,
  name text not null,
  username text not null unique,
  password_hash text not null,
  phone text not null unique,
  email text unique,
  role text not null check (role in ('worker', 'manager')),
  active boolean not null default true,
  pending_approval boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.worker_profiles (
  id text primary key,
  user_id text not null unique references public.users(id) on delete cascade,
  birth_date date,
  parent_phone text,
  payment_method text,
  bank_details text,
  personal_rate numeric
);

create table if not exists public.sites (
  id text primary key,
  name text not null,
  active boolean not null default true
);

create table if not exists public.job_types (
  id text primary key,
  name text not null,
  active boolean not null default true
);

create table if not exists public.pay_rates (
  id text primary key,
  job_type_id text references public.job_types(id) on delete set null,
  user_id text references public.users(id) on delete cascade,
  min_age int,
  max_age int,
  hourly_rate numeric not null,
  active boolean not null default true
);

create table if not exists public.shifts (
  id text primary key,
  user_id text not null references public.users(id),
  site_id text not null references public.sites(id),
  job_type_id text not null references public.job_types(id),
  work_date date,
  starts_at timestamptz,
  ends_at timestamptz,
  notes text,
  trainee boolean not null default false,
  status text not null default 'scheduled',
  created_by_id text not null references public.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.time_entries (
  id text primary key,
  user_id text not null references public.users(id),
  shift_id text references public.shifts(id) on delete set null,
  site_id text not null references public.sites(id),
  job_type_id text not null references public.job_types(id),
  work_date date not null,
  starts_at timestamptz,
  ends_at timestamptz,
  hours numeric not null,
  hourly_rate numeric not null,
  note text,
  status text not null default 'submitted' check (status in ('draft', 'submitted', 'approved', 'rejected')),
  reviewed_by_id text references public.users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.swap_requests (
  id text primary key,
  shift_id text not null references public.shifts(id) on delete cascade,
  requester_id text not null references public.users(id),
  taker_id text references public.users(id),
  status text not null default 'open',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  meta text
);

create table if not exists public.payroll_periods (
  id text primary key,
  year int not null,
  month int not null,
  locked_at timestamptz,
  locked_by_id text references public.users(id),
  unique (year, month)
);

create table if not exists public.date_chat_messages (
  id text primary key,
  work_date_key text not null,
  user_id text not null references public.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id text primary key,
  user_id text references public.users(id),
  action text not null,
  entity text not null,
  entity_id text not null,
  before text,
  after text,
  created_at timestamptz not null default now()
);

create table if not exists public.otp_codes (
  id text primary key,
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists otp_codes_phone_created_idx
  on public.otp_codes (phone, created_at desc);

create table if not exists public.push_subscriptions (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null
);

create index if not exists date_chat_messages_date_created_idx
  on public.date_chat_messages (work_date_key, created_at);

alter table public.users enable row level security;
alter table public.worker_profiles enable row level security;
alter table public.sites enable row level security;
alter table public.job_types enable row level security;
alter table public.pay_rates enable row level security;
alter table public.shifts enable row level security;
alter table public.time_entries enable row level security;
alter table public.swap_requests enable row level security;
alter table public.notifications enable row level security;
alter table public.payroll_periods enable row level security;
alter table public.date_chat_messages enable row level security;
alter table public.audit_log enable row level security;
alter table public.otp_codes enable row level security;
alter table public.push_subscriptions enable row level security;

-- App currently enforces authorization in server actions.
-- When switching to Supabase Auth, map auth.uid() to public.users
-- and add policies: workers see only their rows, managers see all.
