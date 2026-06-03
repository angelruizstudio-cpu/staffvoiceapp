if object_id('dbo.staffvoice_reports', 'U') is null
begin
create table dbo.staffvoice_reports (
  id uniqueidentifier not null primary key,
  created_at datetimeoffset not null default sysutcdatetime(),
  updated_at datetimeoffset not null default sysutcdatetime(),
  status nvarchar(40) not null default 'new'
    check (status in ('new', 'reviewing', 'closed')),
  report_type nvarchar(80) not null,
  privacy_mode nvarchar(20) not null
    check (privacy_mode in ('anonymous', 'followup')),
  reporting_for nvarchar(20) not null
    check (reporting_for in ('self', 'other')),
  permission nvarchar(120) null,
  description nvarchar(max) not null,
  area nvarchar(180) null,
  urgency nvarchar(80) not null default 'Routine feedback',
  share_council nvarchar(3) not null
    check (share_council in ('Yes', 'No')),
  hr_follow_up nvarchar(3) not null default 'No'
    check (hr_follow_up in ('Yes', 'No')),
  contact nvarchar(240) null,
  contact_method nvarchar(80) null,
  contact_best_time nvarchar(160) null,
  follow_up_notes nvarchar(1000) null,
  tracking_token_hash nvarchar(64) null,
  public_status nvarchar(40) not null default 'received'
    check (public_status in ('received', 'in_review', 'follow_up', 'closed')),
  public_message nvarchar(max) not null default '',
  public_status_updated_at datetimeoffset not null default sysutcdatetime(),
  hr_notes nvarchar(max) not null default ''
);
end;

if not exists (select 1 from sys.indexes where name = 'staffvoice_reports_created_at_idx')
begin
create index staffvoice_reports_created_at_idx
  on dbo.staffvoice_reports (created_at desc);
end;

if not exists (select 1 from sys.indexes where name = 'staffvoice_reports_status_idx')
begin
create index staffvoice_reports_status_idx
  on dbo.staffvoice_reports (status);
end;

if not exists (select 1 from sys.indexes where name = 'staffvoice_reports_tracking_token_hash_idx')
begin
create unique index staffvoice_reports_tracking_token_hash_idx
  on dbo.staffvoice_reports (tracking_token_hash)
  where tracking_token_hash is not null;
end;

if object_id('dbo.staffvoice_users', 'U') is null
begin
create table dbo.staffvoice_users (
  email nvarchar(320) not null primary key,
  name nvarchar(160) not null,
  role nvarchar(20) not null
    check (role in ('owner', 'hr')),
  active bit not null default 1,
  password_salt nvarchar(120) not null,
  password_hash nvarchar(120) not null,
  created_at datetimeoffset not null default sysutcdatetime(),
  updated_at datetimeoffset not null default sysutcdatetime()
);
end;

if object_id('dbo.staffvoice_case_comments', 'U') is null
begin
create table dbo.staffvoice_case_comments (
  id uniqueidentifier not null primary key,
  report_id uniqueidentifier not null,
  created_at datetimeoffset not null default sysutcdatetime(),
  created_by_email nvarchar(320) not null,
  created_by_name nvarchar(160) not null,
  visibility nvarchar(20) not null
    check (visibility in ('internal', 'public')),
  comment nvarchar(max) not null,
  constraint staffvoice_case_comments_report_fk
    foreign key (report_id)
    references dbo.staffvoice_reports(id)
    on delete cascade
);
end;

if not exists (select 1 from sys.indexes where name = 'staffvoice_case_comments_report_created_idx')
begin
create index staffvoice_case_comments_report_created_idx
  on dbo.staffvoice_case_comments (report_id, created_at);
end;
