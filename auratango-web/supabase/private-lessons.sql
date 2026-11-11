-- Source for the private lesson settings migration. Apply once after schema.sql.
create table public.private_teacher_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  teacher text not null check (teacher in ('rick', 'anna'))
);

create table public.private_lesson_settings (
  teacher text primary key check (teacher in ('rick', 'anna')),
  schedule_managed boolean not null default false,
  available_times timestamptz[] not null default '{}'
    check (cardinality(available_times) <= 250 and array_position(available_times, null) is null),
  trial_grosz integer check (trial_grosz between 0 and 10000000),
  package4_grosz integer check (package4_grosz between 0 and 10000000),
  package8_grosz integer check (package8_grosz between 0 and 10000000),
  revision integer not null default 0 check (revision >= 0)
);

insert into public.private_lesson_settings (teacher) values ('rick'), ('anna');

alter table public.private_teacher_access enable row level security;
alter table public.private_lesson_settings enable row level security;

revoke all on public.private_teacher_access, public.private_lesson_settings from anon, authenticated;
grant select on public.private_teacher_access to authenticated;
grant select on public.private_lesson_settings to anon, authenticated;
grant update (schedule_managed, available_times, trial_grosz, package4_grosz, package8_grosz, revision)
  on public.private_lesson_settings to authenticated;

create policy "Teachers read their own assignment"
on public.private_teacher_access for select to authenticated
using (user_id = (select auth.uid()));

create policy "Public private lesson availability and prices"
on public.private_lesson_settings for select to anon, authenticated using (true);

create policy "Teachers update their schedule and administrators update either schedule"
on public.private_lesson_settings for update to authenticated
using (
  exists (select 1 from public.cms_admins a where a.user_id = (select auth.uid()))
  or exists (select 1 from public.private_teacher_access a
    where a.user_id = (select auth.uid()) and a.teacher = private_lesson_settings.teacher)
)
with check (
  exists (select 1 from public.cms_admins a where a.user_id = (select auth.uid()))
  or exists (select 1 from public.private_teacher_access a
    where a.user_id = (select auth.uid()) and a.teacher = private_lesson_settings.teacher)
);
