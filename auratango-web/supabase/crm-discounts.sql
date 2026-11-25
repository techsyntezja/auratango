create table school_crm.discounts (
 id uuid primary key default gen_random_uuid(), code text not null unique check(code ~ '^[A-Z0-9][A-Z0-9_-]{3,39}$'),
 label text not null default '' check(length(label)<=120), kind text not null check(kind in ('percent','fixed')),
 value numeric(10,2) not null check(value>0 and value<=100000 and (kind<>'percent' or value<=100)),
 class_type text not null default 'all' check(class_type in ('all','solo','couples','ladies')),
 months integer check(months in (1,3,6)), starts_on date not null, ends_on date, enabled boolean not null default true,
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(ends_on is null or ends_on>=starts_on)
);
alter table school_crm.discounts enable row level security;
revoke all on school_crm.discounts from public,anon,authenticated;
create function public.crm_discounts(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_code text;
begin
 if auth.uid() is null or not exists(select 1 from public.cms_admins where user_id=auth.uid()) then raise exception 'Administrator access required' using errcode='42501';end if;
 if length(p_data::text)>10000 then raise exception 'Input too large';end if;
 if p_action='discount_list' then return coalesce((select jsonb_agg(d order by d.created_at desc) from school_crm.discounts d),'[]');
 elsif p_action='discount_save' then
 v_code:=upper(trim(p_data->>'code'));
 if nullif(p_data->>'id','') is null then
 insert into school_crm.discounts(code,label,kind,value,class_type,months,starts_on,ends_on,enabled,created_by)
 values(v_code,coalesce(p_data->>'label',''),p_data->>'kind',(p_data->>'value')::numeric,p_data->>'class_type',nullif(p_data->>'months','')::integer,(p_data->>'starts_on')::date,nullif(p_data->>'ends_on','')::date,coalesce((p_data->>'enabled')::boolean,true),auth.uid()) returning id into v_id;
 else
 update school_crm.discounts set code=v_code,label=coalesce(p_data->>'label',''),kind=p_data->>'kind',value=(p_data->>'value')::numeric,class_type=p_data->>'class_type',months=nullif(p_data->>'months','')::integer,starts_on=(p_data->>'starts_on')::date,ends_on=nullif(p_data->>'ends_on','')::date,enabled=coalesce((p_data->>'enabled')::boolean,true),updated_at=now() where id=(p_data->>'id')::uuid returning id into v_id;
 if v_id is null then raise exception 'Discount not found';end if;
 end if;
 elsif p_action='discount_toggle' then
 update school_crm.discounts set enabled=(p_data->>'enabled')::boolean,updated_at=now() where id=(p_data->>'id')::uuid returning id into v_id;
 if v_id is null then raise exception 'Discount not found';end if;
 else raise exception 'Unknown discount action';end if;
 insert into school_crm.history(event,detail,actor) values(p_action,'Discount '||(select code from school_crm.discounts where id=v_id),auth.uid());
 return jsonb_build_object('id',v_id);
end $$;
revoke all on function public.crm_discounts(text,jsonb) from public,anon;
grant execute on function public.crm_discounts(text,jsonb) to authenticated;
create function public.validate_class_discount(p_code text,p_offer text,p_party text,p_months integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d school_crm.discounts; v_day date:=(now() at time zone 'Europe/Warsaw')::date; v_type text; v_base numeric;v_amount numeric;
begin
 if length(p_code)>40 or p_offer not in ('partnered','ladies') or p_party not in ('solo','couple') or p_months not in (1,3,6) or (p_offer='ladies' and p_party<>'solo') then return jsonb_build_object('valid',false);end if;
 v_type:=case when p_offer='ladies' then 'ladies' when p_party='couple' then 'couples' else 'solo' end;
 select * into d from school_crm.discounts where code=upper(trim(p_code)) and enabled and starts_on<=v_day and (ends_on is null or ends_on>=v_day) and class_type in ('all',v_type) and (months is null or months=p_months);
 if not found then return jsonb_build_object('valid',false);end if;
 v_base:=(case when p_party='couple' then 440 else 260 end)*p_months;
 v_amount:=least(v_base,round(case when d.kind='percent' then v_base*d.value/100 else d.value end,2));
 return jsonb_build_object('valid',true,'code',d.code,'base',v_base,'amount',v_amount,'total',v_base-v_amount);
end $$;
revoke all on function public.validate_class_discount(text,text,text,integer) from public;
grant execute on function public.validate_class_discount(text,text,text,integer) to anon,authenticated;
