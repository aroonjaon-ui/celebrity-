-- One-time Supabase setup. Run this once in the Supabase SQL Editor.
-- Safe to re-run: all statements are idempotent.

-- Single row holding the whole application state (JSON blob).
create table if not exists public.app_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);

insert into public.app_state (id, data)
values ('main', '{}'::jsonb)
on conflict (id) do nothing;

alter table public.app_state enable row level security;

-- Admin login credentials. Password is a scrypt hash in salt:hex format.
create table if not exists public.admin_users (
  id text primary key,
  email text not null unique,
  password_hash text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.admin_users enable row level security;

-- Default admin: admin@mercersterling.com / admin123
-- Hash format: <salt>:<scrypt-hex>. Replace password_hash to change the password.
insert into public.admin_users (id, email, password_hash)
values (
  'default',
  'admin@mercersterling.com',
  '35d3217ecad5e663a3b7170f32d688b1:62487b668a97c6279efe34551a30e7fa17337732b3b13514dc54827486af8f8b71c461852f6da7cdf420950c0748fc1b9992b3022f002d8d99de99f257d1781d'
)
on conflict (id) do nothing;

-- Public bucket for uploaded images/files. The public flag lets Supabase
-- serve objects at /storage/v1/object/public/uploads/... without a token.
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict (id) do update set public = true;

-- Anon SELECT is only needed for publicly viewable images.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'public_read_uploads'
  ) then
    create policy public_read_uploads
      on storage.objects
      for select
      to anon
      using (bucket_id = 'uploads');
  end if;
end
$$;
