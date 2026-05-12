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

Create the Supabase tables by running:

```text
supabase/schema.sql
```

Then add these settings under:

```text
Static Web App > Environment variables
```

Then open `/login.html`, expand first-time owner setup, enter the setup code, and create the first owner account. After that owner logs into `/admin`, they can add and deactivate HR reviewers from the Authorized users section without using Azure role management.
