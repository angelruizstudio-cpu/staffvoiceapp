alter table public.staffvoice_reports
  alter column urgency set default 'Routine feedback';

grant usage on schema public to service_role;
grant all privileges on table public.staffvoice_reports to service_role;
