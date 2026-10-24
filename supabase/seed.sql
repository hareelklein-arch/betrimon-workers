-- First-time data for an empty production database.
-- Run after 004_user_password.sql. Demo password for all accounts: betrimon

insert into public.users (id, name, username, password_hash, phone, email, role, active)
values (
  'user_manager',
  'אביגיל שקד',
  'avigail',
  '152a70a1e3c48c1abda61d06b15f8725:908ea0810166d726068514b2b234d583ce8b7e3d6e4699f351c2c0fd55dbc9119ad99fcd7a8017db52e13025be17754eee56846abbcbe01a14316c72487e00aa',
  '0500000001',
  'manager@betrimon.local',
  'manager',
  true
)
on conflict (phone) do update
set username = excluded.username, password_hash = excluded.password_hash;

insert into public.users (id, name, username, password_hash, phone, role, active)
values
  ('user_w2', 'ליאם פרידמן', 'liam', '152a70a1e3c48c1abda61d06b15f8725:908ea0810166d726068514b2b234d583ce8b7e3d6e4699f351c2c0fd55dbc9119ad99fcd7a8017db52e13025be17754eee56846abbcbe01a14316c72487e00aa', '0500000002', 'worker', true),
  ('user_w3', 'נועם אזולאי', 'noam', '152a70a1e3c48c1abda61d06b15f8725:908ea0810166d726068514b2b234d583ce8b7e3d6e4699f351c2c0fd55dbc9119ad99fcd7a8017db52e13025be17754eee56846abbcbe01a14316c72487e00aa', '0500000003', 'worker', true),
  ('user_w4', 'הדר ממן', 'hadar', '152a70a1e3c48c1abda61d06b15f8725:908ea0810166d726068514b2b234d583ce8b7e3d6e4699f351c2c0fd55dbc9119ad99fcd7a8017db52e13025be17754eee56846abbcbe01a14316c72487e00aa', '0500000004', 'worker', true),
  ('user_w5', 'אריאל בן-דוד', 'ariel', '152a70a1e3c48c1abda61d06b15f8725:908ea0810166d726068514b2b234d583ce8b7e3d6e4699f351c2c0fd55dbc9119ad99fcd7a8017db52e13025be17754eee56846abbcbe01a14316c72487e00aa', '0500000005', 'worker', true),
  ('user_w6', 'מיקה רוזן', 'mika', '152a70a1e3c48c1abda61d06b15f8725:908ea0810166d726068514b2b234d583ce8b7e3d6e4699f351c2c0fd55dbc9119ad99fcd7a8017db52e13025be17754eee56846abbcbe01a14316c72487e00aa', '0500000006', 'worker', true),
  ('user_w7', 'עידו שמעוני', 'ido', '152a70a1e3c48c1abda61d06b15f8725:908ea0810166d726068514b2b234d583ce8b7e3d6e4699f351c2c0fd55dbc9119ad99fcd7a8017db52e13025be17754eee56846abbcbe01a14316c72487e00aa', '0500000007', 'worker', true),
  ('user_w8', 'רותם אלקיים', 'rotem', '152a70a1e3c48c1abda61d06b15f8725:908ea0810166d726068514b2b234d583ce8b7e3d6e4699f351c2c0fd55dbc9119ad99fcd7a8017db52e13025be17754eee56846abbcbe01a14316c72487e00aa', '0500000008', 'worker', true),
  ('user_w9', 'גיא סבג', 'guy', '152a70a1e3c48c1abda61d06b15f8725:908ea0810166d726068514b2b234d583ce8b7e3d6e4699f351c2c0fd55dbc9119ad99fcd7a8017db52e13025be17754eee56846abbcbe01a14316c72487e00aa', '0500000009', 'worker', true)
on conflict (phone) do update
set username = excluded.username, password_hash = excluded.password_hash;

insert into public.worker_profiles (id, user_id, birth_date, parent_phone, payment_method)
select v.id, v.user_id, v.birth_date::date, v.parent_phone, v.payment_method
from (
  values
    ('prof_w2', 'user_w2', '2009-03-08', '0520000002', 'bit'),
    ('prof_w3', 'user_w3', '2008-08-19', '0520000003', 'bank'),
    ('prof_w4', 'user_w4', '2010-01-14', '0520000004', 'bit'),
    ('prof_w5', 'user_w5', '2009-06-02', '0520000005', 'bit'),
    ('prof_w6', 'user_w6', '2008-12-27', '0520000006', 'bank'),
    ('prof_w7', 'user_w7', '2010-04-11', '0520000007', 'bit'),
    ('prof_w8', 'user_w8', '2009-10-05', '0520000008', 'bit'),
    ('prof_w9', 'user_w9', '2008-07-23', '0520000009', 'bank')
) as v(id, user_id, birth_date, parent_phone, payment_method)
where exists (select 1 from public.users u where u.id = v.user_id)
  and not exists (select 1 from public.worker_profiles p where p.user_id = v.user_id);

insert into public.sites (id, name, active)
select v.id, v.name, true
from (
  values
    ('site_sport', 'מגרש הספורט'),
    ('site_hall', 'אולם התרבות'),
    ('site_garden', 'גן השעשועים')
) as v(id, name)
where not exists (select 1 from public.sites s where s.name = v.name);

insert into public.job_types (id, name, active)
select v.id, v.name, true
from (
  values
    ('job_guard', 'שמירה'),
    ('job_clean', 'ניקיון'),
    ('job_event', 'עזרה באירוע')
) as v(id, name)
where not exists (select 1 from public.job_types j where j.name = v.name);

insert into public.pay_rates (id, job_type_id, min_age, max_age, hourly_rate, active)
select v.id, v.job_type_id, v.min_age, v.max_age, v.hourly_rate, true
from (
  values
    ('rate_age_15', null, 0, 15, 22.0),
    ('rate_age_17', null, 16, 17, 25.0),
    ('rate_age_18', null, 18, 99, 32.3),
    ('rate_guard', 'job_guard', null, null, 28.0),
    ('rate_event', 'job_event', null, null, 30.0),
    ('rate_clean', 'job_clean', null, null, 24.0)
) as v(id, job_type_id, min_age, max_age, hourly_rate)
where not exists (select 1 from public.pay_rates r where r.id = v.id)
  and (v.job_type_id is null or exists (select 1 from public.job_types j where j.id = v.job_type_id));
