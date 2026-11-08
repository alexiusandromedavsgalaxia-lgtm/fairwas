# Macrospot

Macrospot is a first-party productivity workspace integrated into Fairwas at `httc://macrospot.com`.

## Included pages

- Home dashboard and global workspace search
- Teams-style channels and workspace chat
- Internal mail composer and inbox
- Calendar and events
- Contacts, members, and tasks
- Cloud workspace data and document metadata
- Document, spreadsheet, and presentation text editors
- Browser hand-off to the Fairwas browser
- Actions with manual workflow execution, task creation, and notifications
- Developer console and workspace REST API reference
- Internal domain aliases, cloud platform overview, admin, security, billing, apps, and settings

## Workspace cloud API

The API is served at `/api/macrospot` and uses the D1 binding named `database`.

### Create a workspace

```http
POST /api/macrospot
Content-Type: application/json

{"action":"create"}
```

The response contains a workspace `id`, a random bearer `token`, and the initial state. The token is returned once and stored by the browser in local storage. Treat it as a password.

### Read a workspace

```http
GET /api/macrospot?id=WORKSPACE_ID
Authorization: Bearer WORKSPACE_TOKEN
```

### Save workspace state

```http
POST /api/macrospot
Authorization: Bearer WORKSPACE_TOKEN
Content-Type: application/json

{"action":"save","id":"WORKSPACE_ID","state":{}}
```

The API stores a JSON workspace snapshot in D1. Payloads are limited to 900 KB. The browser keeps a local backup and syncs changes to the cloud endpoint.

## Honest implementation boundaries

This first web release has working workspace persistence and internal interactions, but it is not a Microsoft 365 tenant and does not impersonate Microsoft services.

- Teams channels and messages are internal to the Macrospot workspace. Microsoft Teams calls, meetings, and tenant data require a configured Microsoft Entra ID application and Microsoft Graph OAuth permissions.
- Mail is an internal workspace inbox/draft experience. Sending mail externally requires an SMTP or Graph mail connector.
- Cloud sync stores workspace JSON and document text in D1. Binary object storage requires an R2 or compatible bucket binding.
- Domain entries are internal aliases only. Public domain registration, DNS changes, and certificate issuance require a registrar/DNS provider integration.
- Actions currently run supported in-workspace operations. External actions require connectors, secrets, and permission checks.
- Billing is informational only. No payment processor or bank details are configured.

## Security notes

The workspace bearer token is a high-entropy secret stored in the current browser's local storage. Anyone who obtains it can read and update that workspace. Do not publish it in client-side code, screenshots, or public repositories. For multi-user production use, add identity, per-user roles, token rotation, audit retention, and rate limiting before exposing workspaces to untrusted users.
