-- Private shared shop tasks. Existing repair, inventory and account data are untouched.
create table public.ajd_todos (
 id uuid primary key default gen_random_uuid(),
 title text not null check (char_length(btrim(title)) between 1 and 240),
 notes text not null default '' check (char_length(notes) <= 4000),
 priority text not null default 'normal' check (priority in ('high','normal','low')),
 due_date date,
 completed boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.ajd_todos enable row level security;
revoke all on public.ajd_todos from public, anon, authenticated;
grant select, insert, update, delete on public.ajd_todos to authenticated;
create policy "AJD administrators manage shop tasks" on public.ajd_todos
 for all to authenticated
 using ((select public.ajd_is_admin()))
 with check ((select public.ajd_is_admin()));
create function public.ajd_todos_touch_updated_at() returns trigger
 language plpgsql security invoker set search_path = '' as $$
begin
 new.updated_at := now();
 return new;
end;
$$;
revoke all on function public.ajd_todos_touch_updated_at() from public, anon, authenticated;
create trigger ajd_todos_touch_updated_at before update on public.ajd_todos
 for each row execute function public.ajd_todos_touch_updated_at();
