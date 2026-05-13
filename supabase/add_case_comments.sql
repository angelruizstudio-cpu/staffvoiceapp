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

alter table public.staffvoice_case_comments enable row level security;

grant all privileges on table public.staffvoice_case_comments to service_role;
