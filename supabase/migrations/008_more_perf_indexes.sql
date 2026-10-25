create index if not exists time_entries_status_work_date_idx on public.time_entries (status, work_date);
create index if not exists time_entries_user_id_status_idx on public.time_entries (user_id, status);
create index if not exists swap_requests_status_expires_at_idx on public.swap_requests (status, expires_at);
create index if not exists swap_requests_requester_id_idx on public.swap_requests (requester_id);
