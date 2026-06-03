# Staff Voice App

Progressive Web App for confidential staff concerns.

## Azure setup

The public form is available without login. The HR dashboard at `/admin` uses Staff Voice's own email/password login and checks the internal `staffvoice_users` table for app-level access.

Required application settings:

```text
AZURE_SQL_CONNECTION_STRING=<Azure SQL connection string>
STAFFVOICE_TABLE_NAME=staffvoice_reports
STAFFVOICE_USERS_TABLE_NAME=staffvoice_users
STAFFVOICE_COMMENTS_TABLE_NAME=staffvoice_case_comments
STAFFVOICE_SESSION_SECRET=<long random secret>
STAFFVOICE_SETUP_CODE=<one-time setup code>
```

`STAFFVOICE_SQL_CONNECTION_STRING` and `SQLCONNSTR_STAFFVOICE` are also supported as alternate connection string setting names.

Optional Resend settings for HR email notifications:

```text
RESEND_API_KEY=<Resend API key>
STAFFVOICE_FROM_EMAIL=Staff Voice <no-reply@staffvoice.kingdomtechgroup.org>
STAFFVOICE_NOTIFICATION_EMAILS=hr@example.org,owner@example.org
STAFFVOICE_PUBLIC_URL=https://staffvoice.kingdomtechgroup.org
STAFFVOICE_ADMIN_URL=https://staffvoice.kingdomtechgroup.org/admin
```

When these Resend settings are present, every submitted report sends HR an email with a PDF attachment containing the submitted form details. If the settings are missing or Resend is temporarily unavailable, Staff Voice still saves the report and logs the email error.

Follow-up tracking:

- Reports requesting HR follow-up receive a one-time private status link after submission.
- Anonymous reports marked as a threat, safety concern, crime, illegal activity, or immediate danger also receive a one-time private status link so the submitter can check public case status without identifying themselves.
- The public status page shows only the public status, last public update time, and HR's public message to the employee.
- HR internal notes, contact details, and report details are not shown on the public status page.

Create the Azure SQL tables by running:

```text
azure-sql/schema.sql
```

Legacy Supabase SQL files are kept for reference only. Staff Voice now uses Azure SQL through `AZURE_SQL_CONNECTION_STRING`.

Then add these settings under:

```text
Static Web App > Environment variables
```

Then open `/login.html`, expand first-time owner setup, enter the setup code, and create the first owner account. After that owner logs into `/admin`, they can add and deactivate HR reviewers from the Authorized users section without using Azure role management.
