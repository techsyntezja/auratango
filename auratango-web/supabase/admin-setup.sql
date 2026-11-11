create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.cms_admin_invites(email text primary key check(email=lower(email)));
alter table private.cms_admin_invites enable row level security;
revoke all on private.cms_admin_invites from public, anon, authenticated;
insert into private.cms_admin_invites(email) values('tech.auratango@gmail.com');
create function private.activate_cms_admin() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.email_confirmed_at is not null and exists(select 1 from private.cms_admin_invites where email=lower(new.email)) then
  insert into public.cms_admins(user_id) values(new.id) on conflict do nothing;
  delete from private.cms_admin_invites where email=lower(new.email);
 end if;
 return new;
end;
$$;
revoke all on function private.activate_cms_admin() from public,anon,authenticated;
create trigger activate_reserved_cms_admin after insert or update of email_confirmed_at,email on auth.users for each row execute function private.activate_cms_admin();
revoke execute on function public.rls_auto_enable() from public,anon,authenticated;
