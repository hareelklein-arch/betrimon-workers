alter table public.shifts
  add column if not exists trainee boolean not null default false;
