-- 1. Enable UUID extension (Required for uuid_generate_v4)
create extension if not exists "uuid-ossp";

-- 2. Ensure table exists
create table if not exists user_mosaics (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  type text check (type in ('daily', 'weekly', 'monthly', 'yearly')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  metadata jsonb
);

-- 3. Enable Security (RLS)
alter table user_mosaics enable row level security;

-- 4. Create Policies (Permissions)
-- Allow users to insert their *own* data
drop policy if exists "Users can insert their own mosaics" on user_mosaics;
create policy "Users can insert their own mosaics"
  on user_mosaics for insert
  with check (auth.uid() = user_id);

-- Allow users to see their *own* data
drop policy if exists "Users can view their own mosaics" on user_mosaics;
create policy "Users can view their own mosaics"
  on user_mosaics for select
  using (auth.uid() = user_id);
