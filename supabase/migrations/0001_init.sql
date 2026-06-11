-- ============================================================
-- INK. Card News Studio — initial schema
-- Run in Supabase SQL editor (or `supabase db push`).
-- ============================================================

-- magazines (brand presets) -----------------------------------------------
create table if not exists magazines (
  id           uuid primary key default gen_random_uuid(),
  owner        uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  logo_text    text,
  logo_url     text,
  handle       text,
  cta_headline text default '팔로우하고 더 보기',
  cta_copy     text,
  hashtags     text[] default '{}',
  bg_color     text default '#111110',
  accent_color text default '#ffffff',
  is_default   boolean default false,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- card jobs (one article = one job) ----------------------------------------
create table if not exists card_jobs (
  id              uuid primary key default gen_random_uuid(),
  owner           uuid not null references auth.users(id) on delete cascade,
  magazine_id     uuid references magazines(id) on delete set null,
  category        text,
  source          text,
  source_url      text,
  article_title   text not null,
  article_summary text,
  status          text default 'draft',  -- generating | draft | ready
  created_at      timestamptz default now()
);

-- cards (usually 5 per job) ------------------------------------------------
create table if not exists cards (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references card_jobs(id) on delete cascade,
  idx         int  not null,             -- 0..4
  kind        text not null,             -- cover | body | cta
  title       text,
  body        text,
  hashtags    text[],
  image_url   text,
  text_color  text default '#ffffff',
  font_scale  numeric default 1.0,       -- 0.6 .. 1.6
  align       text default 'bottom-left',
  created_at  timestamptz default now(),
  unique (job_id, idx)
);

-- generation log (rate limit: 10 / day / user) ----------------------------
create table if not exists generation_log (
  id        bigserial primary key,
  owner     uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
create index if not exists generation_log_owner_time on generation_log (owner, created_at);

-- RLS ---------------------------------------------------------------------
alter table magazines      enable row level security;
alter table card_jobs      enable row level security;
alter table cards          enable row level security;
alter table generation_log enable row level security;

create policy "own magazines" on magazines
  for all using (owner = auth.uid()) with check (owner = auth.uid());
create policy "own jobs" on card_jobs
  for all using (owner = auth.uid()) with check (owner = auth.uid());
create policy "own cards" on cards
  for all using (
    exists (select 1 from card_jobs j where j.id = cards.job_id and j.owner = auth.uid())
  );
create policy "own gen log" on generation_log
  for all using (owner = auth.uid()) with check (owner = auth.uid());

-- Storage buckets (create in dashboard, or via storage API):
--   magazine-logos  (public read, owner write)
--   card-images     (public read, owner write)
-- Path convention: card-images/{owner}/{jobId}/{cardIdx}.png
