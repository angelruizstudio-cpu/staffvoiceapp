# Staff Voice App

Progressive Web App for confidential staff concerns.

## Azure setup

The public form is available without login. The HR dashboard is protected at `/admin` and requires the custom Static Web Apps role `hr`.

Required application settings:

```text
STAFFVOICE_STORAGE_CONNECTION_STRING=<Azure Storage account connection string>
STAFFVOICE_TABLE_NAME=StaffVoiceReports
```

Create an Azure Storage account, copy its connection string, and add it under:

```text
Static Web App > Environment variables
```

Then invite the HR reviewers under:

```text
Static Web App > Role management
```

Assign them the role:

```text
hr
```
