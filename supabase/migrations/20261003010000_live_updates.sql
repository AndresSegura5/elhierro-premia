-- Actualización en vivo de las pantallas.
-- Cada cambio relevante inserta un evento por ámbito dentro de la misma transacción que lo
-- provoca. La versión de un ámbito es el id de su último evento. Solo se insertan filas: no
-- hay ningún contador compartido que bloquee a transacciones simultáneas.
create table if not exists public.live_events (
  id bigint generated always as identity primary key,
  scope text not null check (char_length(scope) between 1 and 120),
  created_at timestamptz not null default now()
);

create index if not exists live_events_scope_id_idx on public.live_events (scope, id desc);
create index if not exists live_events_created_at_idx on public.live_events (created_at);

alter table public.live_events enable row level security;
revoke all on table public.live_events from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Registra los eventos y, si el servicio Realtime de Supabase está disponible, envía un aviso
-- sin datos (solo "ha cambiado algo") a cada canal. Si Realtime falla, el sondeo de versiones
-- sigue funcionando.
create or replace function public.live_publish(p_scopes text[], p_topics text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_scopes is null or cardinality(p_scopes) = 0 or cardinality(p_scopes) > 20 then
    raise exception 'Invalid live scopes';
  end if;

  insert into public.live_events (scope) select s from unnest(p_scopes) as s;

  -- Limpieza ocasional de eventos antiguos; las versiones solo necesitan el último de cada ámbito.
  if random() < 0.02 then
    delete from public.live_events where created_at < now() - interval '2 days';
  end if;

  begin
    if p_topics is not null and cardinality(p_topics) > 0 then
      perform realtime.send(
        jsonb_build_object('at', (extract(epoch from clock_timestamp()) * 1000)::bigint),
        'changed',
        t,
        false
      ) from unnest(p_topics) as t;
    end if;
  exception when others then
    null;
  end;
end;
$$;

revoke all on function public.live_publish(text[], text[]) from public, anon, authenticated;
