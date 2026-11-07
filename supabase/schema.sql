-- Fety cloud sync: one JSON blob per authenticated user.
-- Run in Supabase SQL editor after enabling Email auth.

create table if not exists public.fety_user_stores (
  user_id uuid primary key references auth.users (id) on delete cascade,
  store jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.fety_user_stores enable row level security;

create policy "Users read own store"
  on public.fety_user_stores for select
  using (auth.uid() = user_id);

create policy "Users insert own store"
  on public.fety_user_stores for insert
  with check (auth.uid() = user_id);

create policy "Users update own store"
  on public.fety_user_stores for update
  using (auth.uid() = user_id);

create or replace function public.set_fety_user_stores_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists fety_user_stores_updated_at on public.fety_user_stores;
create trigger fety_user_stores_updated_at
  before update on public.fety_user_stores
  for each row execute function public.set_fety_user_stores_updated_at();
