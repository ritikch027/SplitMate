create extension if not exists pgcrypto;

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null,
  token text not null unique,
  platform text not null default 'unknown',
  "deviceName" text not null default '',
  "createdAt" timestamptz not null default timezone('utc', now()),
  "updatedAt" timestamptz not null default timezone('utc', now())
);

create index if not exists push_tokens_user_id_idx
  on public.push_tokens ("userId");

alter table public.push_tokens enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'push_tokens'
      and policyname = 'push_tokens_select_self'
  ) then
    create policy push_tokens_select_self
      on public.push_tokens
      for select
      to authenticated
      using (auth.uid() = "userId");
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'push_tokens'
      and policyname = 'push_tokens_insert_self'
  ) then
    create policy push_tokens_insert_self
      on public.push_tokens
      for insert
      to authenticated
      with check (auth.uid() = "userId");
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'push_tokens'
      and policyname = 'push_tokens_update_self'
  ) then
    create policy push_tokens_update_self
      on public.push_tokens
      for update
      to authenticated
      using (auth.uid() = "userId")
      with check (auth.uid() = "userId");
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'push_tokens'
      and policyname = 'push_tokens_delete_self'
  ) then
    create policy push_tokens_delete_self
      on public.push_tokens
      for delete
      to authenticated
      using (auth.uid() = "userId");
  end if;
end $$;
