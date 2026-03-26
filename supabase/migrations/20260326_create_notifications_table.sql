create extension if not exists pgcrypto;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null,
  "actorId" uuid not null,
  type text not null,
  title text not null,
  message text not null,
  "groupId" uuid,
  "expenseId" uuid,
  "read" boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default timezone('utc', now())
);

create index if not exists notifications_user_id_created_at_idx
  on public.notifications ("userId", "createdAt" desc);

create index if not exists notifications_user_id_read_idx
  on public.notifications ("userId", "read");

create index if not exists notifications_group_id_idx
  on public.notifications ("groupId");

alter table public.notifications enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'notifications_select_self'
  ) then
    create policy notifications_select_self
      on public.notifications
      for select
      to authenticated
      using (auth.uid() = "userId");
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'notifications_insert_by_actor'
  ) then
    create policy notifications_insert_by_actor
      on public.notifications
      for insert
      to authenticated
      with check (auth.uid() = "actorId");
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'notifications_update_self'
  ) then
    create policy notifications_update_self
      on public.notifications
      for update
      to authenticated
      using (auth.uid() = "userId")
      with check (auth.uid() = "userId");
  end if;
end $$;

alter publication supabase_realtime add table public.notifications;
