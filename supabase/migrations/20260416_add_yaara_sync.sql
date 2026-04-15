create table if not exists public.yaara_profiles (
  mobile text primary key,
  name text not null,
  age text,
  gender text,
  email text,
  yaara_female_voice_id text,
  yaar_male_voice_id text,
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.yaara_calls (
  id text primary key,
  user_mobile text not null references public.yaara_profiles(mobile) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  duration integer not null default 0,
  status text not null default 'completed',
  transcript jsonb not null default '[]'::jsonb,
  audio_blob text,
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists yaara_calls_user_mobile_idx on public.yaara_calls(user_mobile, start_time desc);

alter table public.yaara_profiles disable row level security;
alter table public.yaara_calls disable row level security;
