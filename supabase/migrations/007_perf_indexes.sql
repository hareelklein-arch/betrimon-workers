create index if not exists shifts_work_date_status_idx on public.shifts (work_date, status);
create index if not exists shifts_user_id_status_idx on public.shifts (user_id, status);
create index if not exists shifts_starts_at_idx on public.shifts (starts_at);
create index if not exists notifications_user_id_read_at_idx on public.notifications (user_id, read_at);
create index if not exists users_role_active_idx on public.users (role, active);
create index if not exists users_pending_approval_idx on public.users (pending_approval);
