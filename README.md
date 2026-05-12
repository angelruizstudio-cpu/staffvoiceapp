# Staff Voice App

Progressive Web App for confidential staff concerns.

## Azure setup

The public form is available without login. The HR dashboard at `/admin` requires Microsoft login, then Staff Voice checks the internal `StaffVoiceUsers` table for app-level access.

Required application settings:

```text
STAFFVOICE_STORAGE_CONNECTION_STRING=<Azure Storage account connection string>
STAFFVOICE_TABLE_NAME=StaffVoiceReports
STAFFVOICE_USERS_TABLE_NAME=StaffVoiceUsers
STAFFVOICE_OWNER_EMAIL=<first admin email>
```

Create an Azure Storage account, copy its connection string, and add it under:

```text
Static Web App > Environment variables
```

`STAFFVOICE_OWNER_EMAIL` is the first app owner. After that owner logs into `/admin`, they can add and deactivate HR reviewers from the Authorized users section without using Azure role management.
