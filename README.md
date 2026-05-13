# Staff Voice App

Progressive Web App for confidential staff concerns.

## Azure setup

The public form is available without login. The HR dashboard at `/admin` uses Staff Voice's own email/password login and checks the internal `StaffVoiceUsers` table for app-level access.

Required application settings:

```text
SUPABASE_URL=https://zmhjovnmubegshoznbqv.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<Supabase service role key>
STAFFVOICE_TABLE_NAME=staffvoice_reports
STAFFVOICE_USERS_TABLE_NAME=staffvoice_users
STAFFVOICE_SESSION_SECRET=<long random secret>
STAFFVOICE_SETUP_CODE=<one-time setup code>
```

Optional Resend settings for HR email notifications:

```text
RESEND_API_KEY=<Resend API key>
STAFFVOICE_FROM_EMAIL=Staff Voice <no-reply@staffvoice.kingdomtechgroup.org>
STAFFVOICE_NOTIFICATION_EMAILS=hr@example.org,owner@example.org
STAFFVOICE_ADMIN_URL=https://staffvoice.kingdomtechgroup.org/admin
```

When these Resend settings are present, every submitted report sends HR an email with a PDF attachment containing the submitted form details. If the settings are missing or Resend is temporarily unavailable, Staff Voice still saves the report and logs the email error.

Follow-up tracking:

- Reports requesting HR follow-up receive a one-time private status link after submission.
- The public status page shows only the public status, last public update time, and HR's public message to the employee.
- HR internal notes, contact details, and report details are not shown on the public status page.
- Run `supabase/add_public_tracking.sql` on existing Supabase projects before deploying the tracking UI/API.

Create the Supabase tables by running:

```text
supabase/schema.sql
```

If the site shows `permission denied for table staffvoice_users` or `permission denied for table staffvoice_reports`, run:

```text
supabase/grant_service_role_access.sql
```

Then add these settings under:

```text
Static Web App > Environment variables
```

Then open `/login.html`, expand first-time owner setup, enter the setup code, and create the first owner account. After that owner logs into `/admin`, they can add and deactivate HR reviewers from the Authorized users section without using Azure role management.

For production, confirm the Azure Static Web App Production environment uses the complete Supabase `service_role` key, not the anon/public key. If a service role key was ever shared in chat, rotate it in Supabase and update `SUPABASE_SERVICE_ROLE_KEY` in Azure after the app is verified.
