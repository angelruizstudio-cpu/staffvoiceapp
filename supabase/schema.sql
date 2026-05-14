create extension if not exists pgcrypto;

create table if not exists public.staffvoice_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new', 'reviewing', 'closed')),
  report_type text not null,
  privacy_mode text not null check (privacy_mode in ('anonymous', 'followup')),
  reporting_for text not null check (reporting_for in ('self', 'other')),
  permission text,
  description text not null,
  area text,
  urgency text not null default 'Routine feedback',
  share_council text not null check (share_council in ('Yes', 'No')),
  hr_follow_up text not null default 'No' check (hr_follow_up in ('Yes', 'No')),
  contact text,
  contact_method text,
  contact_best_time text,
  follow_up_notes text,
  tracking_token_hash text unique,
  public_status text not null default 'received'
    check (public_status in ('received', 'in_review', 'follow_up', 'closed')),
  public_message text not null default '',
  public_status_updated_at timestamptz not null default now(),
  hr_notes text not null default ''
);

create table if not exists public.staffvoice_users (
  email text primary key,
  name text not null,
  role text not null check (role in ('owner', 'hr')),
  active boolean not null default true,
  password_salt text not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists staffvoice_reports_created_at_idx
  on public.staffvoice_reports (created_at desc);

create index if not exists staffvoice_reports_status_idx
  on public.staffvoice_reports (status);

create table if not exists public.staffvoice_case_comments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.staffvoice_reports(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by_email text not null,
  created_by_name text not null,
  visibility text not null check (visibility in ('internal', 'public')),
  comment text not null
);

create index if not exists staffvoice_case_comments_report_created_idx
  on public.staffvoice_case_comments (report_id, created_at);

alter table public.staffvoice_reports enable row level security;
alter table public.staffvoice_users enable row level security;
alter table public.staffvoice_case_comments enable row level security;

-- The Azure Function uses the Supabase service_role key, which bypasses RLS.
-- No public anon policies are created on purpose.
grant usage on schema public to service_role;

grant all privileges on table public.staffvoice_reports to service_role;
grant all privileges on table public.staffvoice_users to service_role;
grant all privileges on table public.staffvoice_case_comments to service_role;

grant all privileges on all sequences in schema public to service_role;
