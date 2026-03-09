create table if not exists public.intervals_latest_workouts (
  athlete_id text primary key,
  synced_at timestamptz not null default now(),
  source_file text,
  workout jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_intervals_latest_workouts_synced_at
  on public.intervals_latest_workouts (synced_at desc);

create or replace function public.touch_intervals_latest_workouts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_intervals_latest_workouts_updated_at on public.intervals_latest_workouts;
create trigger trg_intervals_latest_workouts_updated_at
before update on public.intervals_latest_workouts
for each row
execute function public.touch_intervals_latest_workouts_updated_at();

create table if not exists public.intervals_workouts_history (
  athlete_id text not null,
  workout_id text not null,
  workout_date timestamptz,
  synced_at timestamptz not null default now(),
  source_file text,
  workout jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (athlete_id, workout_id)
);

create index if not exists idx_intervals_workouts_history_date
  on public.intervals_workouts_history (athlete_id, workout_date desc);

create or replace function public.touch_intervals_workouts_history_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_intervals_workouts_history_updated_at on public.intervals_workouts_history;
create trigger trg_intervals_workouts_history_updated_at
before update on public.intervals_workouts_history
for each row
execute function public.touch_intervals_workouts_history_updated_at();
