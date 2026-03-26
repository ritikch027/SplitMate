create extension if not exists pgcrypto;

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  "groupId" uuid not null,
  description text not null,
  amount numeric(12, 2) not null check (amount > 0),
  category text not null default 'Food',
  "paidBy" uuid not null,
  "paidByName" text not null default '',
  "splitBetween" uuid[] not null,
  splits jsonb not null default '{}'::jsonb,
  "createdBy" uuid not null,
  "createdByName" text not null default '',
  "groupName" text not null default '',
  "createdAt" timestamptz not null default timezone('utc', now()),
  "updatedAt" timestamptz,
  constraint expenses_split_between_nonempty check (cardinality("splitBetween") > 0)
);

create index if not exists expenses_group_id_created_at_idx
  on public.expenses ("groupId", "createdAt" desc);

create index if not exists expenses_split_between_gin_idx
  on public.expenses using gin ("splitBetween");

create index if not exists expenses_created_by_idx
  on public.expenses ("createdBy");

alter table public.expenses enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'expenses'
      and policyname = 'expenses_select_for_authenticated'
  ) then
    create policy expenses_select_for_authenticated
      on public.expenses
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'expenses'
      and policyname = 'expenses_insert_for_authenticated'
  ) then
    create policy expenses_insert_for_authenticated
      on public.expenses
      for insert
      to authenticated
      with check (auth.uid() = "createdBy");
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'expenses'
      and policyname = 'expenses_update_for_creator'
  ) then
    create policy expenses_update_for_creator
      on public.expenses
      for update
      to authenticated
      using (auth.uid() = "createdBy")
      with check (auth.uid() = "createdBy");
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'expenses'
      and policyname = 'expenses_delete_for_creator'
  ) then
    create policy expenses_delete_for_creator
      on public.expenses
      for delete
      to authenticated
      using (auth.uid() = "createdBy");
  end if;
end $$;

alter publication supabase_realtime add table public.expenses;
