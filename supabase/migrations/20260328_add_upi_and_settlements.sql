alter table public.users
  add column if not exists "upiId" text not null default '';

create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  "groupId" uuid not null,
  "paidBy" uuid not null,
  "paidTo" uuid not null,
  amount numeric(12, 2) not null check (amount > 0),
  "createdAt" timestamptz not null default timezone('utc', now())
);

create index if not exists settlements_group_id_created_at_idx
  on public.settlements ("groupId", "createdAt" desc);

create index if not exists settlements_paid_by_idx
  on public.settlements ("paidBy");

create index if not exists settlements_paid_to_idx
  on public.settlements ("paidTo");

alter table public.settlements enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'settlements'
      and policyname = 'settlements_select_for_authenticated'
  ) then
    create policy settlements_select_for_authenticated
      on public.settlements
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'settlements'
      and policyname = 'settlements_insert_for_payer'
  ) then
    create policy settlements_insert_for_payer
      on public.settlements
      for insert
      to authenticated
      with check (auth.uid() = "paidBy");
  end if;
end $$;

alter publication supabase_realtime add table public.settlements;
