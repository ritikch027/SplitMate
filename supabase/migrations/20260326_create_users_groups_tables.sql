create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key,
  phone text not null unique,
  name text not null default '',
  "photoUrl" text not null default '',
  "profileCompleted" boolean not null default false,
  groups uuid[] not null default '{}'::uuid[],
  "createdAt" timestamptz not null default timezone('utc', now()),
  "updatedAt" timestamptz
);

create index if not exists users_phone_idx
  on public.users (phone);

create index if not exists users_groups_gin_idx
  on public.users using gin (groups);

alter table public.users enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and policyname = 'users_select_for_authenticated'
  ) then
    create policy users_select_for_authenticated
      on public.users
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and policyname = 'users_insert_self'
  ) then
    create policy users_insert_self
      on public.users
      for insert
      to authenticated
      with check (auth.uid() = id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and policyname = 'users_update_self'
  ) then
    create policy users_update_self
      on public.users
      for update
      to authenticated
      using (auth.uid() = id)
      with check (auth.uid() = id);
  end if;
end $$;

alter publication supabase_realtime add table public.users;

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text not null default '👥',
  members uuid[] not null,
  "createdBy" uuid not null,
  "createdAt" timestamptz not null default timezone('utc', now()),
  "lastActivity" timestamptz not null default timezone('utc', now()),
  constraint groups_name_length check (char_length(name) between 2 and 50),
  constraint groups_members_nonempty check (cardinality(members) > 0),
  constraint groups_members_limit check (cardinality(members) <= 25)
);

create index if not exists groups_members_gin_idx
  on public.groups using gin (members);

create index if not exists groups_last_activity_idx
  on public.groups ("lastActivity" desc);

create index if not exists groups_created_by_idx
  on public.groups ("createdBy");

alter table public.groups enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'groups'
      and policyname = 'groups_select_for_authenticated'
  ) then
    create policy groups_select_for_authenticated
      on public.groups
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'groups'
      and policyname = 'groups_insert_creator_member'
  ) then
    create policy groups_insert_creator_member
      on public.groups
      for insert
      to authenticated
      with check (
        auth.uid() = "createdBy"
        and auth.uid() = any(members)
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'groups'
      and policyname = 'groups_update_member'
  ) then
    create policy groups_update_member
      on public.groups
      for update
      to authenticated
      using (auth.uid() = any(members))
      with check (auth.uid() = any(members));
  end if;
end $$;

alter publication supabase_realtime add table public.groups;
