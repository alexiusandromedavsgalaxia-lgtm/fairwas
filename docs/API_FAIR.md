# API.fair

API.fair is the public developer API for publishing static sites into Fairwas.

## Publish a site

Endpoint: `POST httc://api.fair/api/publish-site`

Authenticate with a per-developer API key created in the API.fair console. Send JSON:

```json
{
  "domain": "my-project",
  "title": "My project",
  "files": [
    { "path": "/index.html", "content": "<h1>Hello Fairwas</h1>" },
    { "path": "/assets/site.css", "content": "body { font-family: sans-serif }" }
  ]
}
```

Example from a site running inside the Fairwas HTTC runtime:

```js
const response = await fetch("httc://api.fair/api/publish-site", {
  method: "POST",
  headers: {
    "Authorization": "Bearer fw_live_YOUR_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    domain: "my-project",
    title: "My project",
    files: [{ path: "/index.html", content: "<h1>Hello Fairwas</h1>" }]
  })
});
const result = await response.json();
```

The response contains `site_id`, `domain`, `url`, `version`, and `status`.

## Limits

- Up to 300 files per publish.
- Up to 15 MiB of uncompressed file content.
- `/index.html` is required.
- File paths cannot contain traversal segments.
- A domain must be unique across Fairwas Pages and Server.

## API keys

Create and revoke keys in the API.fair console. Keys are shown once, stored as SHA-256 hashes, and scoped to the developer account that created them. Keep them on a trusted server, not in public browser code.

## Publish manifest

Configure a manifest when creating a site in CreatePage. The manifest is stored with the developer account and applied on the server.

Supported declarative rule:

```xml
<manifest>
   getData * UserPlan,
   if UserPlan = Free put domain "(name-web).plataforma.app"
</manifest>
```

For a Free account publishing `my-project`, the rule selects `my-project-web.plataforma.app`. The plan is loaded from the API key owner account, never trusted from the request body. The manifest is a restricted rule format, not executable XML or JavaScript.

## Documentation routes

- `httc://docs.api.fair/doc/publish-site`
- `httc://docs.api.fair/doc/authentication`
- `httc://docs.api.fair/doc/manifest`
- `httc://docs.api.fair/doc/errors`
