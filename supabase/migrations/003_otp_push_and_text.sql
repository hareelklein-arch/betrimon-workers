-- Additive production updates for an existing 001_init.sql database.
-- Safe to re-run. Prisma maps camelCase fields to these snake_case names.

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

alter table public.date_chat_messages enable row level security;
alter table public.otp_codes enable row level security;
alter table public.push_subscriptions enable row level security;

alter table public.notifications
  alter column meta type text using meta::text;

alter table public.audit_log
  alter column before type text using before::text;

alter table public.audit_log
  alter column after type text using after::text;
