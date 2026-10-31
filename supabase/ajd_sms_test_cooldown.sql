-- Mirror of the applied Supabase migration ajd_sms_test_cooldown.
-- Private rate limits prevent repeated billable SMS test attempts.
create table if not exists ajd_private.ajd_sms_test_limits (
 user_id uuid primary key references auth.users(id) on delete cascade,
 last_attempt_at timestamptz not null default '-infinity'::timestamptz,
 utc_day date not null default ((now() at time zone 'UTC')::date),
 attempts_today integer not null default 0 check (attempts_today between 0 and 3)
);
alter table ajd_private.ajd_sms_test_limits enable row level security;
revoke all on ajd_private.ajd_sms_test_limits from public, anon, authenticated;

create or replace function public.ajd_reserve_sms_test()
returns boolean language plpgsql security definer set search_path = ''
as $function$
declare
 v_user uuid := (select auth.uid());
 v_prev ajd_private.ajd_sms_test_limits%rowtype;
 v_today date := ((pg_catalog.now() at time zone 'UTC')::date);
begin
 if v_user is null or not (select public.ajd_is_admin()) then
  raise exception 'Administrator access required' using errcode='42501';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 97233));
 select * into v_prev from ajd_private.ajd_sms_test_limits where user_id=v_user;
 if found and v_prev.last_attempt_at > pg_catalog.now() - interval '5 minutes' then
  raise exception 'Please wait at least 5 minutes between live SMS tests' using errcode='P0001';
 end if;
 if found and v_prev.utc_day=v_today and v_prev.attempts_today >= 3 then
  raise exception 'Daily SMS test limit reached (3 per UTC day)' using errcode='P0001';
 end if;
 insert into ajd_private.ajd_sms_test_limits(user_id,last_attempt_at,utc_day,attempts_today)
 values(v_user,pg_catalog.now(),v_today,1)
 on conflict(user_id) do update
 set last_attempt_at=excluded.last_attempt_at,
     utc_day=v_today,
     attempts_today=case when ajd_private.ajd_sms_test_limits.utc_day=v_today
       then ajd_private.ajd_sms_test_limits.attempts_today+1 else 1 end;
 return true;
end;
$function$;
revoke all on function public.ajd_reserve_sms_test() from public, anon;
grant execute on function public.ajd_reserve_sms_test() to authenticated;
