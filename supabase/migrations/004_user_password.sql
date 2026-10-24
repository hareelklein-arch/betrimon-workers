-- Username + password login. Run in Supabase SQL Editor, then run supabase/seed.sql
-- (or the UPDATE block at the bottom) so existing demo users can sign in.

alter table public.users add column if not exists username text;
alter table public.users add column if not exists password_hash text;

update public.users
set username = 'user_' || replace(id, '-', '')
where username is null or username = '';

update public.users
set password_hash = 'pending-reset'
where password_hash is null or password_hash = '';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_username_key'
  ) then
    alter table public.users add constraint users_username_key unique (username);
  end if;
end $$;

alter table public.users alter column username set not null;
alter table public.users alter column password_hash set not null;
