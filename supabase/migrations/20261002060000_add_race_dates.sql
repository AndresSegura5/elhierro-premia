alter table public.races add column if not exists race_date date;

update public.races
set race_date = case id
  when 'bestial' then date '2026-10-24'
  when 'bimbache' then date '2026-11-14'
  when 'meridiano' then date '2027-01-30'
  else start_date
end
where race_date is null;
