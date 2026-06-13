-- Stolkwebdesign — Reserveringen/Afspraken-module (afspraak-tijdslot booking)
-- Klant boekt een vrij slot; admin beheert diensten + openingstijden. Anon krijgt GEEN table-rechten:
-- lezen (diensten + vrije slots) via SECURITY DEFINER RPC's; aanmaken via de Edge-function
-- create-booking.js (service-role). Draaien: Supabase Dashboard → SQL Editor → plak → Run.

create extension if not exists pgcrypto;

create table if not exists public.stolkwebdesign_booking_services (
  id uuid primary key default gen_random_uuid(),
  name text not null, duration_min int not null default 30,
  description text, active boolean default true, sort int default 0,
  created_at timestamptz default now()
);

create table if not exists public.stolkwebdesign_booking_hours (
  id uuid primary key default gen_random_uuid(),
  weekday int not null,                      -- Postgres dow: 0=zo .. 6=za
  start_time time not null, end_time time not null, active boolean default true
);

create table if not exists public.stolkwebdesign_booking_blocked (
  id uuid primary key default gen_random_uuid(),
  date date not null, start_time time, end_time time, reason text,
  created_at timestamptz default now()
);
create index if not exists idx_booking_blocked_date on public.stolkwebdesign_booking_blocked (date);

create table if not exists public.stolkwebdesign_booking_bookings (
  id uuid primary key default gen_random_uuid(),
  service_id uuid references public.stolkwebdesign_booking_services(id) on delete set null,
  service_name text, slot_start timestamptz not null, slot_end timestamptz not null,
  customer_name text not null, customer_email text not null, customer_phone text, notes text,
  status text not null default 'bevestigd',  -- bevestigd | geannuleerd
  cancel_token text unique not null default encode(gen_random_bytes(24), 'hex'),
  viewer_ip text, viewer_user_agent text, created_at timestamptz default now(),
  -- single-resource: geen twee actieve afspraken die in tijd overlappen (race-safe → 23P01)
  constraint swd_booking_no_overlap exclude using gist (tstzrange(slot_start, slot_end) with &&) where (status <> 'geannuleerd')
);
create index if not exists idx_bookings_start on public.stolkwebdesign_booking_bookings (slot_start);

create table if not exists public.stolkwebdesign_booking_settings (
  id int primary key default 1, data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now(), constraint swd_booking_settings_singleton check (id = 1)
);
insert into public.stolkwebdesign_booking_settings (id, data) values
  (1, '{"slot_interval_min":30,"lead_time_min":120,"max_days_ahead":30,"timezone":"Europe/Amsterdam","bevestigingstekst":"Bedankt voor je afspraak.","annuleringsbeleid":"Tot 24 uur van tevoren kosteloos annuleren via de link in je bevestiging."}'::jsonb)
  on conflict (id) do nothing;

-- RLS: admin = volledige CRUD; anon = niets direct
alter table public.stolkwebdesign_booking_services enable row level security;
alter table public.stolkwebdesign_booking_hours    enable row level security;
alter table public.stolkwebdesign_booking_blocked  enable row level security;
alter table public.stolkwebdesign_booking_bookings         enable row level security;
alter table public.stolkwebdesign_booking_settings enable row level security;

drop policy if exists "booking services auth all" on public.stolkwebdesign_booking_services;
drop policy if exists "booking hours auth all"    on public.stolkwebdesign_booking_hours;
drop policy if exists "booking blocked auth all"  on public.stolkwebdesign_booking_blocked;
drop policy if exists "stolkwebdesign_booking_bookings auth all"         on public.stolkwebdesign_booking_bookings;
drop policy if exists "booking settings auth all" on public.stolkwebdesign_booking_settings;
create policy "booking services auth all" on public.stolkwebdesign_booking_services for all to authenticated using (true) with check (true);
create policy "booking hours auth all"    on public.stolkwebdesign_booking_hours    for all to authenticated using (true) with check (true);
create policy "booking blocked auth all"  on public.stolkwebdesign_booking_blocked  for all to authenticated using (true) with check (true);
create policy "stolkwebdesign_booking_bookings auth all"         on public.stolkwebdesign_booking_bookings         for all to authenticated using (true) with check (true);
create policy "booking settings auth all" on public.stolkwebdesign_booking_settings for all to authenticated using (true) with check (true);

revoke all on public.stolkwebdesign_booking_services from anon;
revoke all on public.stolkwebdesign_booking_hours    from anon;
revoke all on public.stolkwebdesign_booking_blocked  from anon;
revoke all on public.stolkwebdesign_booking_bookings         from anon;
revoke all on public.stolkwebdesign_booking_settings from anon;

-- RPC's (anon-callable)
create or replace function public.get_booking_services()
returns jsonb language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'duration_min',duration_min,'description',description) order by sort, name), '[]'::jsonb)
    from public.stolkwebdesign_booking_services where active;
$$;

create or replace function public.get_available_slots(p_service_id uuid, p_from date, p_to date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_dur int; v_interval int; v_lead int; v_max int; v_tz text;
begin
  select duration_min into v_dur from public.stolkwebdesign_booking_services where id = p_service_id and active;
  if v_dur is null then return '[]'::jsonb; end if;
  select coalesce((data->>'slot_interval_min')::int,30), coalesce((data->>'lead_time_min')::int,120),
         coalesce((data->>'max_days_ahead')::int,30), coalesce(data->>'timezone','Europe/Amsterdam')
    into v_interval, v_lead, v_max, v_tz from public.stolkwebdesign_booking_settings where id = 1;
  v_interval:=coalesce(v_interval,30); v_lead:=coalesce(v_lead,120); v_max:=coalesce(v_max,30); v_tz:=coalesce(v_tz,'Europe/Amsterdam');
  return coalesce((
    select jsonb_agg(gs order by gs)
    from generate_series(greatest(p_from, current_date), least(p_to, current_date + v_max), interval '1 day') d
    join public.stolkwebdesign_booking_hours h on h.active and h.weekday = extract(dow from d)::int
    cross join lateral generate_series((d + h.start_time) at time zone v_tz, (d + h.end_time) at time zone v_tz - make_interval(mins => v_dur), make_interval(mins => v_interval)) gs
    where gs >= now() + make_interval(mins => v_lead)
      and not exists (select 1 from public.stolkwebdesign_booking_bookings b where b.status <> 'geannuleerd' and tstzrange(b.slot_start,b.slot_end) && tstzrange(gs, gs + make_interval(mins => v_dur)))
      and not exists (select 1 from public.stolkwebdesign_booking_blocked bl where bl.date = (gs at time zone v_tz)::date
            and (bl.start_time is null or ((gs at time zone v_tz)::time < coalesce(bl.end_time, time '23:59:59') and ((gs at time zone v_tz) + make_interval(mins => v_dur))::time > bl.start_time)))
  ), '[]'::jsonb);
end; $$;

create or replace function public.cancel_booking(p_cancel_token text, p_email text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  update public.stolkwebdesign_booking_bookings set status='geannuleerd' where cancel_token=p_cancel_token and lower(customer_email)=lower(p_email) and status<>'geannuleerd';
  get diagnostics v_n = row_count; return v_n > 0;
end; $$;

grant execute on function public.get_booking_services()                to anon, authenticated;
grant execute on function public.get_available_slots(uuid, date, date) to anon, authenticated;
grant execute on function public.cancel_booking(text, text)            to anon, authenticated;

-- Demo-seed (alleen als er nog geen diensten zijn)
do $$
begin
  if not exists (select 1 from public.stolkwebdesign_booking_services) then
    insert into public.stolkwebdesign_booking_services(name, duration_min, description, sort) values
      ('Kennismakingsgesprek', 30, 'Vrijblijvend kennismaken — 30 minuten.', 1),
      ('Adviesgesprek', 60, 'Uitgebreid adviesgesprek — 60 minuten.', 2);
    insert into public.stolkwebdesign_booking_hours(weekday, start_time, end_time) values
      (1,'09:00','17:00'),(2,'09:00','17:00'),(3,'09:00','17:00'),(4,'09:00','17:00'),(5,'09:00','17:00');
  end if;
end $$;
