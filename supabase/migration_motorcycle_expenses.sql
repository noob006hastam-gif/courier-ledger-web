-- Additive migration: does not alter or delete orders/settlements.
create table if not exists public.motorcycle_expenses (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 expense_date date not null default current_date,
 category text not null check(category in ('fuel','oil','repair','parts','other')),
 amount bigint not null default 0 check(amount>=0),
 odometer_km integer check(odometer_km is null or odometer_km>=0),
 description text not null default '',
 next_service_km integer check(next_service_km is null or next_service_km>=0),
 created_at timestamptz not null default now()
);

create index if not exists motorcycle_expenses_user_date_idx
on public.motorcycle_expenses(user_id, expense_date desc);

alter table public.motorcycle_expenses enable row level security;

drop policy if exists "Users can read own motorcycle expenses"
on public.motorcycle_expenses;

create policy "Users can read own motorcycle expenses"
on public.motorcycle_expenses
for select using(auth.uid()=user_id);

drop policy if exists "Users can insert own motorcycle expenses"
on public.motorcycle_expenses;

create policy "Users can insert own motorcycle expenses"
on public.motorcycle_expenses
for insert with check(auth.uid()=user_id);

drop policy if exists "Users can update own motorcycle expenses"
on public.motorcycle_expenses;

create policy "Users can update own motorcycle expenses"
on public.motorcycle_expenses
for update using(auth.uid()=user_id)
with check(auth.uid()=user_id);

drop policy if exists "Users can delete own motorcycle expenses"
on public.motorcycle_expenses;

create policy "Users can delete own motorcycle expenses"
on public.motorcycle_expenses
for delete using(auth.uid()=user_id);