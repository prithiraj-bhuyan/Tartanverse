create table user_mosaics (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  type text check (type in ('daily', 'weekly', 'monthly', 'yearly')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  metadata jsonb
);
