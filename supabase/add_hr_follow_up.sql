alter table public.staffvoice_reports
  add column if not exists hr_follow_up text not null default 'No'
  check (hr_follow_up in ('Yes', 'No'));

alter table public.staffvoice_reports
  add column if not exists contact_method text,
  add column if not exists contact_best_time text,
  add column if not exists follow_up_notes text;
