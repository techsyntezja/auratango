-- Run once in Supabase SQL editor.
create table public.cms_admins(user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.cms_admins enable row level security;
create policy "Own admin membership" on public.cms_admins for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.cms_admins from anon,authenticated;
grant select on public.cms_admins to authenticated;
create table public.site_content(id text primary key check(id='main'),published jsonb not null default '{"edits":{},"theme":{}}',updated_at timestamptz not null default now());
create table public.site_drafts(id text primary key check(id='main'),draft jsonb not null default '{"edits":{},"theme":{}}',updated_at timestamptz not null default now());
insert into public.site_content(id) values('main');
insert into public.site_drafts(id) values('main');
alter table public.site_content enable row level security;
alter table public.site_drafts enable row level security;
revoke all on public.site_content,public.site_drafts from anon,authenticated;
grant select on public.site_content to anon,authenticated;
grant update on public.site_content to authenticated;
grant select,update on public.site_drafts to authenticated;
create policy "Public published document" on public.site_content for select to anon,authenticated using(true);
create policy "Admin publication" on public.site_content for update to authenticated using(exists(select 1 from public.cms_admins where user_id=(select auth.uid()))) with check(exists(select 1 from public.cms_admins where user_id=(select auth.uid())));
create policy "Admin drafts read" on public.site_drafts for select to authenticated using(exists(select 1 from public.cms_admins where user_id=(select auth.uid())));
create policy "Admin drafts update" on public.site_drafts for update to authenticated using(exists(select 1 from public.cms_admins where user_id=(select auth.uid()))) with check(exists(select 1 from public.cms_admins where user_id=(select auth.uid())));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('site-media','site-media',true,10485760,array['image/jpeg','image/png','image/webp','image/gif']);
create policy "Public website images" on storage.objects for select to anon,authenticated using(bucket_id='site-media');
create policy "Admin image uploads" on storage.objects for insert to authenticated with check(bucket_id='site-media' and exists(select 1 from public.cms_admins where user_id=(select auth.uid())));
-- Create an admin in Supabase Authentication > Users, then use their UUID:
-- insert into public.cms_admins(user_id) values('YOUR-ADMIN-USER-UUID');
