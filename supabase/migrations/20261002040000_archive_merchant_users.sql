alter table public.users add column if not exists archived_at timestamptz;
alter table public.users add column if not exists archived_by bigint references public.users(id) on delete set null;
create index if not exists users_archived_at_idx on public.users(archived_at);
