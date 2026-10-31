-- Test notification is a private admin inbox event only. No email/SMS/push dispatch.
alter table public.ajd_notification_events drop constraint if exists ajd_notification_events_event_type_check;
alter table public.ajd_notification_events add constraint ajd_notification_events_event_type_check
 check (event_type in ('repair_request','store_order','payment','customer_message','repair_status','test'));
alter table public.ajd_notification_events drop constraint if exists ajd_notification_events_subject_table_check;
alter table public.ajd_notification_events add constraint ajd_notification_events_subject_table_check
 check (subject_table in ('repair_requests','repairs','store_purchase_requests','purchase_requests','ajd_customer_messages','admin_notification_test'));

create or replace function public.ajd_send_test_notification()
returns uuid language plpgsql security definer set search_path = ''
as $function$
declare v_user uuid := (select auth.uid()); v_event uuid;
begin
  if v_user is null or not (select public.ajd_is_admin()) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 87362));
  if exists (
    select 1 from public.ajd_notification_deliveries d
    join public.ajd_notification_events e on e.id = d.event_id
    where d.user_id=v_user and e.event_type='test'
      and e.created_at > pg_catalog.now() - interval '20 seconds'
  ) then
    raise exception 'Please wait 20 seconds between test notifications' using errcode = 'P0001';
  end if;
  insert into public.ajd_notification_events(event_type,subject_table,subject_id,title,body)
  values ('test','admin_notification_test',v_user::text,'Test notification','Your AJD''s Wireless Repairs admin notification inbox is working. No email or text was sent.')
  returning id into v_event;
  insert into public.ajd_notification_deliveries(event_id,user_id) values(v_event,v_user);
  return v_event;
end;
$function$;
revoke all on function public.ajd_send_test_notification() from public, anon;
grant execute on function public.ajd_send_test_notification() to authenticated;
