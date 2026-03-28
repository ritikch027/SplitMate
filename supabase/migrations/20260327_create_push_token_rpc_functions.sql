create or replace function public.claim_push_token(
  p_token text,
  p_platform text default 'unknown',
  p_device_name text default ''
)
returns public.push_tokens
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  claimed_row public.push_tokens;
begin
  if current_user_id is null then
    raise exception 'Unauthorized';
  end if;

  if p_token is null or length(trim(p_token)) = 0 then
    raise exception 'Push token is required';
  end if;

  delete from public.push_tokens
  where token = p_token;

  insert into public.push_tokens (
    "userId",
    token,
    platform,
    "deviceName",
    "updatedAt"
  )
  values (
    current_user_id,
    p_token,
    coalesce(nullif(trim(p_platform), ''), 'unknown'),
    coalesce(p_device_name, ''),
    timezone('utc', now())
  )
  returning * into claimed_row;

  return claimed_row;
end;
$$;

create or replace function public.release_push_token(
  p_token text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Unauthorized';
  end if;

  if p_token is null or length(trim(p_token)) = 0 then
    return true;
  end if;

  delete from public.push_tokens
  where "userId" = current_user_id
    and token = p_token;

  return true;
end;
$$;

revoke all on function public.claim_push_token(text, text, text) from public;
grant execute on function public.claim_push_token(text, text, text) to authenticated;

revoke all on function public.release_push_token(text) from public;
grant execute on function public.release_push_token(text) to authenticated;
