-- ============================================================
-- conversions table: stores one row per successful conversion
-- Run this in the Supabase SQL editor (Project -> SQL Editor)
-- ============================================================

create table if not exists public.conversions (
    id           bigint generated always as identity primary key,
    user_id      uuid not null references auth.users(id) on delete cascade,
    amount       numeric not null,
    from_currency text not null,
    to_currency   text not null,
    result       numeric not null,
    created_at   timestamptz not null default now()
);

-- Helpful indexes for dashboard queries
create index if not exists conversions_user_id_idx on public.conversions (user_id);
create index if not exists conversions_created_at_idx on public.conversions (created_at desc);

-- Enable Row Level Security
alter table public.conversions enable row level security;

-- A user can only see their own conversion history
create policy "Users can view their own conversions"
    on public.conversions
    for select
    using (auth.uid() = user_id);

-- A user can only insert rows tagged with their own user_id
create policy "Users can insert their own conversions"
    on public.conversions
    for insert
    with check (auth.uid() = user_id);

-- (Optional) allow users to delete their own history entries
create policy "Users can delete their own conversions"
    on public.conversions
    for delete
    using (auth.uid() = user_id);
