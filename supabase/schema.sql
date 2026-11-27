-- ============================================================================
-- TOEIC Mastery Hub — Supabase Database Schema & Row Level Security (RLS)
-- Copy toàn bộ file này và chạy 1 lần duy nhất trong Supabase SQL Editor.
-- ============================================================================

-- 1. Helper trigger tự động cập nhật cột updated_at mỗi khi bản ghi thay đổi
create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- ============================================================================
-- 2. Bảng PROFILES — Hồ sơ người học (khớp 1-1 với auth.users)
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  target_score integer not null default 750 check (target_score >= 10 and target_score <= 990),
  daily_goal integer not null default 20 check (daily_goal >= 5 and daily_goal <= 200),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_current_timestamp_updated_at();

-- ============================================================================
-- 3. Bảng USER_PROGRESS — Tiến độ học tập tách từng mảng JSONB rõ ràng
-- Lưu ý bảo mật: KHÔNG lưu Gemini API Key cá nhân lên bảng này.
-- ============================================================================
create table if not exists public.user_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  vocab_srs jsonb not null default '{}'::jsonb,
  saved_words jsonb not null default '[]'::jsonb,
  user_notes jsonb not null default '[]'::jsonb,
  toeic_history jsonb not null default '{}'::jsonb,
  reading_progress jsonb not null default '{}'::jsonb,
  listening_progress jsonb not null default '{}'::jsonb,
  writing_history jsonb not null default '{}'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists trg_user_progress_updated_at on public.user_progress;
create trigger trg_user_progress_updated_at
  before update on public.user_progress
  for each row
  execute function public.set_current_timestamp_updated_at();

-- ============================================================================
-- 4. Trigger tự động tạo hồ sơ (profiles) & bản ghi tiến độ (user_progress)
-- ngay khi user đăng ký mới bằng Email/Mật khẩu hoặc Google OAuth
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  derived_name text;
  derived_avatar text;
begin
  derived_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(coalesce(new.email, ''), '@', 1),
    'Học viên TOEIC'
  );

  derived_avatar := coalesce(
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'picture',
    null
  );

  insert into public.profiles (id, email, full_name, avatar_url, target_score, daily_goal)
  values (new.id, new.email, derived_name, derived_avatar, 750, 20)
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
        updated_at = timezone('utc', now());

  insert into public.user_progress (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ============================================================================
-- 5. Bật ROW LEVEL SECURITY (RLS) & Policies chặt chẽ cho từng người dùng
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.user_progress enable row level security;

-- Policies cho bảng profiles
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Policies cho bảng user_progress
drop policy if exists "user_progress_select_own" on public.user_progress;
create policy "user_progress_select_own"
  on public.user_progress
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_progress_insert_own" on public.user_progress;
create policy "user_progress_insert_own"
  on public.user_progress
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_progress_update_own" on public.user_progress;
create policy "user_progress_update_own"
  on public.user_progress
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Cấp quyền thao tác cơ bản cho role authenticated (RLS vẫn kiểm soát từng dòng)
grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.user_progress to authenticated;
