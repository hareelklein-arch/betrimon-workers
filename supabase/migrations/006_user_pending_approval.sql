alter table public.users
  add column if not exists pending_approval boolean not null default false;
