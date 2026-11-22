-- Upgrade only; included in crm.sql for fresh installations.
create or replace function public.crm_trial_inquiry(p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_email text:=nullif(lower(trim(p_data->>'email')),'');
 v_phone text:=nullif(regexp_replace(coalesce(p_data->>'phone',''),'[^0-9]','','g'),'');
 v_submission uuid:=(p_data->>'submission_id')::uuid;
begin
 if coalesce(length(p_data->>'website'),0)>0 then raise exception 'Invalid submission'; end if;
 if v_submission is null or length(trim(coalesce(p_data->>'name',''))) not between 1 and 120
 or (v_email is null and v_phone is null) or coalesce(p_data->>'consent','false')<>'true'
 or (v_email is not null and v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
 or (v_phone is not null and length(v_phone) not between 7 and 15)
 or ((p_data->>'contact_method') in ('Phone','WhatsApp') and v_phone is null) or ((p_data->>'contact_method')='Email' and v_email is null)
 or length(p_data::text)>10000 then raise exception 'Please check your name, contact details and agreements'; end if;
 perform pg_advisory_xact_lock(hashtextextended(coalesce(v_email,v_phone),0));
 if exists(select 1 from school_crm.leads where submission_id=v_submission) then return '{"saved":true}'::jsonb; end if;
 if (select count(*) from school_crm.leads where created_at>now()-interval '1 day' and (email=v_email or phone=v_phone))>=5 then
 raise exception 'Too many inquiries. Please contact the studio directly.'; end if;
 insert into school_crm.leads(submission_id,name,email,phone,contact_method,preference,source)
 values(v_submission,trim(p_data->>'name'),v_email,v_phone,coalesce(nullif(p_data->>'contact_method',''),'Email'),left(coalesce(p_data->>'preference',''),1000),'Website trial') returning id into v_id;
 insert into school_crm.history(lead_id,event,detail) values(v_id,'Inquiry received','Public trial form submitted; terms and privacy acknowledged. A preferred date is not a reservation.');
 return '{"saved":true}'::jsonb;
end $$;



-- All mutations and reads recheck the administrator membership on the database server.
create or replace function public.crm_staff(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare l school_crm.leads; c school_crm.classes; b school_crm.bookings;
 v_id uuid; v_student uuid; v_other uuid; v_status text; v_detail text; v_email text; v_phone text;
 v_start timestamptz; v_end timestamptz; v_capacity integer; v_membership uuid; v_class_day date;
begin
 if auth.uid() is null or not exists(select 1 from public.cms_admins where user_id=auth.uid()) then
 raise exception 'Administrator access required' using errcode='42501'; end if;
 if length(p_data::text)>20000 then raise exception 'Input too large'; end if;
 if p_action='load' then
 return jsonb_build_object('leads',coalesce((select jsonb_agg(x order by x.created_at desc) from school_crm.leads x),'[]'),
 'classes',coalesce((select jsonb_agg(x order by x.starts_at) from school_crm.classes x),'[]'),
 'bookings',coalesce((select jsonb_agg(x) from school_crm.bookings x),'[]'),
 'students',coalesce((select jsonb_agg(x order by x.name) from school_crm.students x),'[]'),
 'memberships',coalesce((select jsonb_agg(x order by x.created_at desc) from school_crm.memberships x),'[]'),
 'history',coalesce((select jsonb_agg(x order by x.created_at desc) from school_crm.history x),'[]'));
 elsif p_action in ('lead_save','note') then
 if nullif(p_data->>'id','') is not null then
 select * into l from school_crm.leads where id=(p_data->>'id')::uuid for update;
 if not found then raise exception 'Lead not found'; end if;
 end if;
 if p_action='note' then
 if l.id is null or length(trim(coalesce(p_data->>'note','')))=0 then raise exception 'Enter a note'; end if;
 insert into school_crm.history(lead_id,student_id,event,detail,actor) values(l.id,l.student_id,'Note',left(p_data->>'note',5000),auth.uid());return jsonb_build_object('id',l.id);
 end if;
 v_email:=nullif(lower(trim(p_data->>'email')),'');v_phone:=nullif(regexp_replace(coalesce(p_data->>'phone',''),'[^0-9]','','g'),'');
 if length(trim(coalesce(p_data->>'name','')))=0 or (v_email is null and v_phone is null) then raise exception 'Name and email or phone are required';end if;
 if (p_data->>'contact_method') in ('Phone','WhatsApp') and v_phone is null then raise exception 'A phone number is required for this contact method';end if;
 if (p_data->>'contact_method')='Email' and v_email is null then raise exception 'An email is required for this contact method';end if;
 v_status:=coalesce(p_data->>'status','New');
 if v_status in ('Trial Booked','Trial Attended','Converted') and v_status is distinct from l.status then raise exception 'Use booking, attendance or conversion actions for this status';end if;
 if l.id is null then
 insert into school_crm.leads(name,email,phone,contact_method,preference,source,status,follow_up)
 values(trim(p_data->>'name'),v_email,v_phone,coalesce(p_data->>'contact_method','Email'),coalesce(p_data->>'preference',''),coalesce(nullif(p_data->>'source',''),'Manual'),v_status,nullif(p_data->>'follow_up','')::date) returning id into v_id;
 v_detail:='Lead created';
 else
 update school_crm.leads set name=trim(p_data->>'name'),email=v_email,phone=v_phone,contact_method=p_data->>'contact_method',preference=coalesce(p_data->>'preference',''),source=p_data->>'source',status=v_status,follow_up=nullif(p_data->>'follow_up','')::date,updated_at=now() where id=l.id;
 v_id:=l.id;v_detail:='Details updated; status: '||l.status||' → '||v_status;
 end if;
 insert into school_crm.history(lead_id,student_id,event,detail,actor) values(v_id,l.student_id,'Lead updated',v_detail,auth.uid());
 if length(trim(coalesce(p_data->>'note','')))>0 then insert into school_crm.history(lead_id,event,detail,actor) values(v_id,'Note',p_data->>'note',auth.uid());end if;
 return jsonb_build_object('id',v_id);
 elsif p_action='class_save' then
 perform pg_advisory_xact_lock(82734621);
 v_id:=coalesce(nullif(p_data->>'id','')::uuid,gen_random_uuid());v_start:=(p_data->>'starts_at')::timestamptz;v_end:=(p_data->>'ends_at')::timestamptz;v_capacity:=(p_data->>'capacity')::integer;
 perform 1 from school_crm.classes where id=v_id for update;
 if v_capacity<(select count(*) from school_crm.bookings where class_id=v_id and status='Booked') then raise exception 'Capacity cannot be below the current roster';end if;
 if exists(select 1 from school_crm.bookings own join school_crm.bookings other on (own.lead_id=other.lead_id or own.student_id=other.student_id) and own.id<>other.id join school_crm.classes x on x.id=other.class_id where own.class_id=v_id and other.class_id<>v_id and own.status='Booked' and other.status='Booked' and not x.cancelled and x.starts_at<v_end and x.ends_at>v_start) then raise exception 'New time conflicts with a roster member’s other class';end if;
 insert into school_crm.classes(id,group_name,class_type,instructor,room,starts_at,ends_at,capacity) values(v_id,p_data->>'group_name',p_data->>'class_type',p_data->>'instructor',p_data->>'room',v_start,v_end,v_capacity)
 on conflict(id) do update set group_name=excluded.group_name,class_type=excluded.class_type,instructor=excluded.instructor,room=excluded.room,starts_at=excluded.starts_at,ends_at=excluded.ends_at,capacity=excluded.capacity;
 return jsonb_build_object('id',v_id);
 elsif p_action='book' then
 -- Global scheduling lock serializes reschedules and capacity checks across classes.
 perform pg_advisory_xact_lock(82734621);
 select * into c from school_crm.classes where id=(p_data->>'class_id')::uuid for update;
 if not found or c.cancelled or c.ends_at<now() then raise exception 'Choose an upcoming active class';end if;
 if nullif(p_data->>'lead_id','') is not null then
 select * into l from school_crm.leads where id=(p_data->>'lead_id')::uuid for update;
 if not found then raise exception 'Lead not found';end if;v_student:=l.student_id;
 else
 v_student:=(p_data->>'student_id')::uuid;
 if not exists(select 1 from school_crm.students where id=v_student) then raise exception 'Student not found';end if;
 end if;
 if exists(select 1 from school_crm.bookings where class_id=c.id and status='Booked' and (lead_id=l.id or student_id=v_student)) then raise exception 'Already booked into this class';end if;
 if (select count(*) from school_crm.bookings where class_id=c.id and status='Booked')>=c.capacity then raise exception 'Class is full';end if;
 if exists(select 1 from school_crm.bookings x join school_crm.classes y on y.id=x.class_id left join school_crm.leads z on z.id=x.lead_id left join school_crm.students person on person.id=x.student_id where x.status='Booked' and not y.cancelled and y.starts_at<c.ends_at and y.ends_at>c.starts_at and (x.lead_id=l.id or x.student_id=v_student or (l.email is not null and z.email=l.email) or (l.phone is not null and z.phone=l.phone) or (l.email is not null and lower(person.email)=lower(l.email)) or (l.phone is not null and person.phone=l.phone)) and x.id is distinct from nullif(p_data->>'replace_booking','')::uuid) then raise exception 'This person already has an overlapping booking';end if;
 if nullif(p_data->>'replace_booking','') is not null then
 update school_crm.bookings set status='Cancelled' where id=(p_data->>'replace_booking')::uuid and lead_id=l.id and status='Booked';
 if not found then raise exception 'Previous trial booking not found';end if;
 end if;
 insert into school_crm.bookings(class_id,lead_id,student_id) values(c.id,l.id,v_student) returning id into v_id;
 if l.id is not null then update school_crm.leads set status=case when status='Converted' then status else 'Trial Booked' end,updated_at=now() where id=l.id;end if;
 insert into school_crm.history(lead_id,student_id,event,detail,actor) values(l.id,v_student,'Booking',case when nullif(p_data->>'replace_booking','') is not null then 'Trial rescheduled: ' else 'Booked: ' end||c.group_name||' · '||c.starts_at::text,auth.uid());
 return jsonb_build_object('id',v_id);
 elsif p_action in ('cancel','attendance') then
 perform pg_advisory_xact_lock(82734621);
 select * into b from school_crm.bookings where id=(p_data->>'booking_id')::uuid for update;
 if not found or b.status<>'Booked' then raise exception 'Active booking not found';end if;
 if p_action='cancel' then
 if b.membership_id is not null then update school_crm.memberships set remaining_sessions=least(total_sessions,remaining_sessions+1) where id=b.membership_id;end if;
 update school_crm.bookings set status='Cancelled',membership_id=null where id=b.id;
 update school_crm.leads set status='Contacted',updated_at=now() where id=b.lead_id and status='Trial Booked' and not exists(select 1 from school_crm.bookings where lead_id=b.lead_id and status='Booked' and id<>b.id);
 v_detail:='Booking cancelled; spot released';
 else
 v_status:=p_data->>'attendance';
 if b.attendance='Present' and v_status<>'Present' and b.membership_id is not null then
 update school_crm.memberships set remaining_sessions=least(total_sessions,remaining_sessions+1) where id=b.membership_id;
 update school_crm.bookings set membership_id=null where id=b.id;
 elsif v_status='Present' and b.attendance<>'Present' and b.student_id is not null then
 select (starts_at at time zone 'Europe/Warsaw')::date into v_class_day from school_crm.classes where id=b.class_id;
 select id into v_membership from school_crm.memberships where student_id=b.student_id and starts_on<=v_class_day and expires_on>=v_class_day and remaining_sessions>0 order by expires_on,created_at limit 1 for update;
 if v_membership is not null then update school_crm.memberships set remaining_sessions=remaining_sessions-1 where id=v_membership;update school_crm.bookings set membership_id=v_membership where id=b.id;end if;
 end if;
 update school_crm.bookings set attendance=v_status where id=b.id;
 if v_status='Present' then update school_crm.leads set status='Trial Attended',updated_at=now() where id=b.lead_id and status='Trial Booked';end if;
 v_detail:='Attendance: '||b.attendance||' → '||v_status;
 end if;
 insert into school_crm.history(lead_id,student_id,event,detail,actor) values(b.lead_id,b.student_id,p_action,v_detail,auth.uid());return jsonb_build_object('id',b.id);
 elsif p_action='convert' then
 perform pg_advisory_xact_lock(82734622);
 select * into l from school_crm.leads where id=(p_data->>'lead_id')::uuid for update;
 if not found then raise exception 'Lead not found';end if;
 if l.student_id is not null then return jsonb_build_object('id',l.student_id);end if;
 select id into v_student from school_crm.students where (l.email is not null and lower(email)=lower(l.email)) or (l.phone is not null and phone=l.phone) order by created_at limit 1;
 if (select count(*) from school_crm.students where (l.email is not null and lower(email)=lower(l.email)) or (l.phone is not null and phone=l.phone))>1 then raise exception 'Contact details match different students; review before converting';end if;
 if v_student is null then insert into school_crm.students(name,email,phone,group_name) values(l.name,l.email,l.phone,coalesce(p_data->>'group_name','')) returning id into v_student;end if;
 update school_crm.leads set student_id=v_student,status='Converted',updated_at=now() where id=l.id;
 update school_crm.bookings set student_id=v_student where lead_id=l.id;
 insert into school_crm.history(lead_id,student_id,event,detail,actor) values(l.id,v_student,'Converted','Lead linked to student; contact and inquiry history retained',auth.uid());return jsonb_build_object('id',v_student);
 elsif p_action='membership' then
 v_student:=(p_data->>'student_id')::uuid;
 insert into school_crm.memberships(student_id,plan,starts_on,expires_on,total_sessions,remaining_sessions) values(v_student,p_data->>'plan',(p_data->>'starts_on')::date,(p_data->>'expires_on')::date,(p_data->>'total_sessions')::integer,(p_data->>'remaining_sessions')::integer) returning id into v_id;
 update school_crm.students set group_name=coalesce(p_data->>'group_name',group_name) where id=v_student;
 insert into school_crm.history(student_id,event,detail,actor) values(v_student,'Membership recorded',(p_data->>'plan')||'; payment handled outside CRM',auth.uid());return jsonb_build_object('id',v_id);
 end if;
 raise exception 'Unknown CRM action';
end $$;
