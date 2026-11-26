-- Public insert-only contact intake; records remain in the private staff CRM.
create or replace function public.crm_contact_inquiry(p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 v_id uuid;
 v_phone text := nullif(regexp_replace(coalesce(p_data->>'phone',''),'[^0-9]','','g'),'');
 v_submission uuid := (p_data->>'submission_id')::uuid;
 v_email text := lower(trim(coalesce(p_data->>'email','')));
 v_name text := trim(coalesce(p_data->>'name',''));
 v_message text := trim(coalesce(p_data->>'message',''));
 v_reason text := coalesce(p_data->>'reason','');
 v_date date;
 v_source text;
begin
 if v_submission is null or v_reason not in ('event','cooperation')
 or length(v_name) not between 1 and 120
 or length(v_email) not between 3 and 254
 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
 or (v_phone is not null and length(v_phone) not between 7 and 15)
 or length(v_message) not between 1 and 5000
 or length(coalesce(p_data->>'venue',''))>200
 or length(coalesce(p_data->>'website',''))>0
 or length(p_data::text)>10000 then raise exception 'Please check your name, email and message'; end if;
 if v_reason='event' and length(trim(coalesce(p_data->>'venue','')))=0 then
 raise exception 'Please enter a city or venue'; end if;
 v_date := nullif(p_data->>'eventDate','')::date;
 v_source := case when v_reason='event' then 'Event invitation' else 'Cooperation' end;
 perform pg_advisory_xact_lock(hashtextextended(v_email,0));
 if exists(select 1 from school_crm.leads where submission_id=v_submission) then
 return jsonb_build_object('saved',true); end if;
 if (select count(*) from school_crm.leads where email=v_email and created_at>now()-interval '1 day')>=5 then
 raise exception 'Too many inquiries. Please contact the studio directly.'; end if;
 insert into school_crm.leads(submission_id,name,email,phone,contact_method,preference,source)
 values(v_submission,v_name,v_email,v_phone,'Email',concat_ws(' · ',v_source,v_date::text,nullif(trim(p_data->>'venue'),'')),v_source)
 returning id into v_id;
 insert into school_crm.history(lead_id,event,detail)
 values(v_id,'Contact request received',concat_ws(E'\n',v_source,
 case when v_date is not null then 'Event date: '||v_date::text end,
 case when nullif(trim(p_data->>'venue'),'') is not null then 'City / venue: '||trim(p_data->>'venue') end,
 '',v_message));
 return jsonb_build_object('saved',true);
end $$;
revoke all on function public.crm_contact_inquiry(jsonb) from public;
grant execute on function public.crm_contact_inquiry(jsonb) to anon,authenticated;
