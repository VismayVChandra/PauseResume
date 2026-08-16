-- GenForge AI Resume Platform — minimal schema (no auth for MVP / demo mode)
-- Run this in the Supabase SQL editor for your project.

create extension if not exists "uuid-ossp";

-- Raw, un-tailored profile extracted from a LinkedIn PDF (or pasted text / manual entry).
-- One profile can later be used to generate resumes for multiple target roles.
create table if not exists career_profiles (
  id uuid primary key default uuid_generate_v4(),
  session_id text not null,                 -- anonymous demo-mode identifier (no auth)
  source text not null default 'pdf',        -- 'pdf' | 'pasted_text' | 'manual' | 'demo'
  raw_text text,                             -- original extracted text, for re-processing/debugging
  profile_json jsonb not null,               -- structured neutral profile (see types/resume.ts: RawProfile)
  created_at timestamptz not null default now()
);

-- A tailored resume generated from a career_profile + a target role.
create table if not exists resumes (
  id uuid primary key default uuid_generate_v4(),
  career_profile_id uuid references career_profiles(id) on delete cascade,
  target_role text not null,                 -- what the user typed in step 1
  resume_json jsonb not null,                -- structured tailored resume (see types/resume.ts: TailoredResume)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_career_profiles_session on career_profiles(session_id);
create index if not exists idx_resumes_profile on resumes(career_profile_id);

-- Demo mode: no auth, so RLS is left permissive on purpose. Before any real
-- deployment beyond the hackathon demo, add auth and scope these policies
-- to auth.uid() instead of leaving them open.
alter table career_profiles enable row level security;
alter table resumes enable row level security;

create policy "demo_mode_all_access_profiles" on career_profiles
  for all using (true) with check (true);

create policy "demo_mode_all_access_resumes" on resumes
  for all using (true) with check (true);
