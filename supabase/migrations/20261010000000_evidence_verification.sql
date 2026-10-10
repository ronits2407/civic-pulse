-- Credible Evidence Validation & Resolution Verification (forward-only)
-- Intake credibility and resolution verification are separate, append-only tracks.

-- ---------------------------------------------------------------------------
-- issues: verification state kept distinct from operational status
-- ---------------------------------------------------------------------------
alter table public.issues
  add column if not exists resolution_verification_state text not null default 'not_claimed'
    check (resolution_verification_state in
      ('not_claimed', 'awaiting_proof', 'awaiting_community', 'verified', 'disputed', 'unverified')),
  add column if not exists resolution_round integer not null default 0,
  add column if not exists review_expires_at timestamptz,
  add column if not exists location_source text
    check (location_source is null or location_source in ('device_gps', 'map_pin')),
  add column if not exists location_accuracy_m numeric,
  add column if not exists location_captured_at timestamptz;

create index if not exists issues_resolution_state_idx
  on public.issues (resolution_verification_state)
  where resolution_verification_state <> 'not_claimed';

-- ---------------------------------------------------------------------------
-- Municipal staff memberships (department scoped)
-- ---------------------------------------------------------------------------
create table if not exists public.municipal_staff_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, department_id)
);
create index if not exists municipal_staff_user_idx on public.municipal_staff_memberships (user_id) where active;

-- ---------------------------------------------------------------------------
-- Append-only evidence records
-- ---------------------------------------------------------------------------
create table if not exists public.issue_evidence (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  stage text not null check (stage in ('intake', 'resolution')),
  round integer not null default 0,
  kind text not null check (kind in ('photo', 'video_keyframe', 'note')),
  storage_path text,                       -- private bucket path, never exposed to clients
  mime_type text,
  size_bytes integer,
  notes text,
  captured_at timestamptz,
  location geography(point, 4326),         -- private; never returned by public APIs
  location_source text check (location_source is null or location_source in ('device_gps', 'map_pin')),
  location_accuracy_m numeric,
  submitted_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists issue_evidence_issue_idx on public.issue_evidence (issue_id, stage, round);

create table if not exists public.evidence_assessments (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  stage text not null check (stage in ('intake', 'resolution')),
  round integer not null default 0,
  confidence_index integer not null check (confidence_index between 0 and 100),
  evidence_coverage numeric not null check (evidence_coverage between 0 and 1),
  risk_level text not null check (risk_level in ('low', 'medium', 'high')),
  risk_flags text[] not null default '{}',
  signals jsonb not null default '[]'::jsonb,
  explanation text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists evidence_assessments_issue_idx on public.evidence_assessments (issue_id, stage, created_at desc);

create table if not exists public.evidence_reviews (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  round integer not null,
  reviewer_id uuid not null references public.profiles(id),
  verdict text not null check (verdict in ('fixed', 'partially_fixed', 'still_present', 'cant_tell')),
  comment text,
  created_at timestamptz not null default now(),
  unique (issue_id, round, reviewer_id)
);
create index if not exists evidence_reviews_issue_idx on public.evidence_reviews (issue_id, round);

create table if not exists public.issue_events (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  event_type text not null,
  actor_id uuid references public.profiles(id),
  actor_role text check (actor_role is null or actor_role in ('system', 'citizen', 'municipal_staff', 'admin')),
  from_state text,
  to_state text,
  round integer,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists issue_events_issue_idx on public.issue_events (issue_id, created_at);

-- Immutability: evidence, assessments, reviews and events can never be changed or removed.
create or replace function public.prevent_evidence_mutation()
returns trigger as $$
begin
  -- Allow cascading deletes when the parent issue has been removed.
  if tg_op = 'DELETE' and not exists (select 1 from public.issues where id = old.issue_id) then
    return old;
  end if;
  raise exception '% on % is not allowed: records are append-only', tg_op, tg_table_name;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array['issue_evidence', 'evidence_assessments', 'evidence_reviews', 'issue_events'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_append_only', t);
    execute format(
      'create trigger %I before update or delete on public.%I for each row execute function public.prevent_evidence_mutation()',
      t || '_append_only', t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security: all writes go through server routes using the service role.
-- ---------------------------------------------------------------------------
alter table public.municipal_staff_memberships enable row level security;
alter table public.issue_evidence enable row level security;
alter table public.evidence_assessments enable row level security;
alter table public.evidence_reviews enable row level security;
alter table public.issue_events enable row level security;

drop policy if exists "Staff can read own membership" on public.municipal_staff_memberships;
create policy "Staff can read own membership" on public.municipal_staff_memberships
  for select using (auth.uid() = user_id);

-- issue_evidence has no client policies: rows hold private paths and coordinates.

drop policy if exists "Anyone can read assessments" on public.evidence_assessments;
create policy "Anyone can read assessments" on public.evidence_assessments
  for select using (true);

drop policy if exists "Reviewers can read own reviews" on public.evidence_reviews;
create policy "Reviewers can read own reviews" on public.evidence_reviews
  for select using (auth.uid() = reviewer_id);

drop policy if exists "Anyone can read issue events" on public.issue_events;
create policy "Anyone can read issue events" on public.issue_events
  for select using (true);

-- ---------------------------------------------------------------------------
-- Private storage bucket: no public reads, signed URLs only, folder-isolated uploads
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'issue-evidence', 'issue-evidence', false, 20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Evidence upload to own folder" on storage.objects;
create policy "Evidence upload to own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'issue-evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Evidence read own folder" on storage.objects;
create policy "Evidence read own folder" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'issue-evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
-- No update/delete policies: uploaded evidence cannot be altered by clients.

