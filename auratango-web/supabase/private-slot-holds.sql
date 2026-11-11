-- Apply after private-lessons.sql. Each published start time has one temporary hold.
create schema private_booking;
revoke all on schema private_booking from public;
grant usage on schema private_booking to anon, authenticated;

create table private_booking.slot_holds (
  teacher text not null references public.private_lesson_settings (teacher),
  starts_at timestamptz not null,
  token uuid not null,
  expires_at timestamptz not null,
  primary key (teacher, starts_at)
);
alter table private_booking.slot_holds enable row level security;
revoke all on private_booking.slot_holds from public, anon, authenticated;

create function private_booking.change_hold(p_teacher text, p_slot timestamptz, p_token uuid, p_action text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  expiration timestamptz;
begin
  if p_token is null or p_slot is null then return null; end if;

  if p_action = 'release' then
    delete from private_booking.slot_holds h
    where h.teacher = p_teacher and h.starts_at = p_slot and h.token = p_token;
    return jsonb_build_object('released', found);
  end if;

  if p_action is null or p_action not in ('hold', 'finish') or p_slot <= clock_timestamp() or not exists (
    select 1 from public.private_lesson_settings s
    where s.teacher = p_teacher and s.schedule_managed and p_slot = any(s.available_times)
  ) then return null; end if;

  if p_action = 'finish' then
    -- The current request flow is a local demo. It completes the hold without creating a real booking.
    delete from private_booking.slot_holds h
    where h.teacher = p_teacher and h.starts_at = p_slot and h.token = p_token and h.expires_at > clock_timestamp();
    return jsonb_build_object('finished', found);
  end if;

  insert into private_booking.slot_holds as h (teacher, starts_at, token, expires_at)
  values (p_teacher, p_slot, p_token, least(p_slot, clock_timestamp() + interval '10 minutes'))
  on conflict (teacher, starts_at) do update
  set token = excluded.token,
      expires_at = case when h.expires_at > clock_timestamp() then h.expires_at else excluded.expires_at end
  where h.expires_at <= clock_timestamp() or h.token = excluded.token
  returning h.expires_at into expiration;

  if expiration is null then return null; end if;
  return jsonb_build_object('secondsLeft', greatest(0, floor(extract(epoch from expiration - clock_timestamp()))));
end;
$$;

create function public.private_slot_hold(p_teacher text, p_slot timestamptz, p_token uuid, p_action text)
returns jsonb language sql security invoker set search_path = '' as $$
  select private_booking.change_hold(p_teacher, p_slot, p_token, p_action);
$$;

revoke execute on function private_booking.change_hold(text,timestamptz,uuid,text) from public, anon, authenticated;
revoke execute on function public.private_slot_hold(text,timestamptz,uuid,text) from public, anon, authenticated;
grant execute on function private_booking.change_hold(text,timestamptz,uuid,text) to anon, authenticated;
grant execute on function public.private_slot_hold(text,timestamptz,uuid,text) to anon, authenticated;
