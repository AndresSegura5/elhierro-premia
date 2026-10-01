-- Atomic rate limits shared by every Vercel instance. Only the private server
-- database role may execute these functions or access the underlying counters.
create table public.request_limits (
  scope text not null,
  identifier_hash text not null,
  window_started_at timestamptz not null,
  attempt_count integer not null check (attempt_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (scope, identifier_hash)
);
create index request_limits_updated_at_idx on public.request_limits(updated_at);
alter table public.request_limits enable row level security;
revoke all on public.request_limits from anon, authenticated;

create function public.consume_request_limit(p_scope text, p_identifier_hash text, p_maximum integer, p_window_seconds integer)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql security definer set search_path = '' as $$
declare
  current_count integer;
  current_window timestamptz;
  v_now timestamptz := clock_timestamp();
begin
  if p_scope not in ('login-ip', 'login-account', 'coupon-public', 'coupon-user', 'redeem-user')
    or p_identifier_hash !~ '^[a-f0-9]{64}$'
    or p_maximum not between 1 and 1000 or p_window_seconds not between 1 and 3600 then
    raise exception 'Invalid rate limit parameters';
  end if;
  insert into public.request_limits as limits (scope, identifier_hash, window_started_at, attempt_count, updated_at)
  values (p_scope, p_identifier_hash, v_now, 1, v_now)
  on conflict (scope, identifier_hash) do update set
    window_started_at = case when limits.window_started_at <= v_now - make_interval(secs => p_window_seconds) then v_now else limits.window_started_at end,
    attempt_count = case when limits.window_started_at <= v_now - make_interval(secs => p_window_seconds) then 1 else least(limits.attempt_count + 1, p_maximum + 1) end,
    updated_at = v_now
  returning limits.attempt_count, limits.window_started_at into current_count, current_window;
  if random() < 0.01 then
    delete from public.request_limits where updated_at < v_now - interval '1 day';
  end if;
  return query select current_count <= p_maximum,
    case when current_count <= p_maximum then 0 else greatest(1, ceil(extract(epoch from (current_window + make_interval(secs => p_window_seconds) - v_now)))::integer) end;
end;
$$;
revoke all on function public.consume_request_limit(text, text, integer, integer) from public, anon, authenticated;

-- Fix the old function too, so the previous deployment is protected during rollout.
create or replace function public.consume_coupon_lookup(p_identifier_hash text, p_now timestamptz default now())
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql security definer set search_path = '' as $$
declare current_count integer; current_window timestamptz;
begin
  insert into public.public_lookup_limits as limits (identifier_hash, window_started_at, attempt_count, updated_at)
  values (p_identifier_hash, p_now, 1, p_now)
  on conflict (identifier_hash) do update set
    window_started_at = case when limits.window_started_at <= p_now - interval '15 minutes' then p_now else limits.window_started_at end,
    attempt_count = case when limits.window_started_at <= p_now - interval '15 minutes' then 1 else least(limits.attempt_count + 1, 11) end,
    updated_at = p_now
  returning limits.attempt_count, limits.window_started_at into current_count, current_window;
  return query select current_count <= 10,
    case when current_count <= 10 then 0 else greatest(1, ceil(extract(epoch from (current_window + interval '15 minutes' - p_now)))::integer) end;
end;
$$;
revoke all on function public.consume_coupon_lookup(text, timestamptz) from public, anon, authenticated;

alter table public.redemptions add column idempotency_key uuid;
create unique index redemptions_idempotency_idx on public.redemptions(business_id, idempotency_key) where idempotency_key is not null;

-- Longer codes for newly issued coupons. Existing printed codes remain valid.
alter table public.coupons drop constraint coupons_code_check;
alter table public.coupons add constraint coupons_code_check check (
  code ~ '^EH-(BES|BIM|MER)-([A-HJ-KM-NP-Z][1-9][A-HJ-KM-NP-Z][1-9]{3}[A-HJ-KM-NP-Z]|[A-HJ-KM-NP-Z1-9]{12})$'
);

