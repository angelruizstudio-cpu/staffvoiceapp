alter table public.staffvoice_reports
  add column if not exists hr_follow_up text not null default 'No'
  check (hr_follow_up in ('Yes', 'No'));
