# Fairwas AI Studio

AI Studio is the website creation workspace for Fairwas. It combines an AI-assisted editor, preview, project management, publishing, model selection, plans, and community activities.

## Create a page

1. Open **Create page**.
2. Describe the purpose of the site, its audience, the pages or sections it needs, and the visual direction.
3. Choose a model:
   - `llama-3.3-70b-versatile`: balanced general-purpose generation.
   - `openai/gpt-oss-120b`: complex briefs and multi-part changes.
   - `llama-3.1-8b-instant`: faster iterations and prototypes.
4. Review the generated page in the preview.
5. Ask for incremental edits. Mention what should remain unchanged and what should be modified.

The AI endpoint is `POST /api/ai-studio`. The Groq key is read server-side from the `AISTUDIO_KEY` secret and must never be placed in browser code.

## Edit an existing site

Open **My sites**, select a project, and choose **Edit page**. AI Studio loads the site's `/index.html` into the editor. Changes remain in the editor until you explicitly publish or update the site.

The existing CreatePage update endpoint is used for owned projects:

- `GET /api/createpage?action=site&site_id=<site-id>` loads site metadata and files.
- `POST /api/createpage?action=update` updates an owned site and publishes the supplied files.

The API verifies ownership against the signed-in Fairwas account. A user cannot edit another developer's site by guessing its ID.

## Drafts

Use **Save draft** in the editor. Drafts are stored in the current browser's local storage under `fairwas:aistudio:drafts:v1`. They can be reopened from **My sites** and edited again.

Important: these AI Studio drafts are device/browser-local. They are not cloud backups and do not automatically synchronize between devices. A draft does not change the live published site. From **My sites**, you can also retire a currently published site. An unpublished site can be reopened, edited, and published again.

## Publish a new site

1. Open **Website settings**.
2. Set the site title, free subdomain, contact email, and description.
3. Choose **Publish**.
4. For a new site, AI Studio creates or reuses a developer API key through the Fairwas publishing API and sends the page files to `POST /api/publish-site`.
5. For an existing site, AI Studio uses the authenticated CreatePage update action.

Free-plan AI Studio addresses use the `.aistudio.fair` suffix. Fairwas HTTC addresses are internal to the Fairwas runtime and do not automatically create public DNS records.

## Website settings

- **Title:** the site's displayed name.
- **Subdomain:** the internal Fairwas hostname. It must be valid and available.
- **Contact email:** text to include in the generated page where relevant. This does not create a mailbox or configure DNS email records.
- **Description:** a short summary of the website.
- **Language:** the language the generated page should use.
- **Accent color:** the preferred primary color.
- **SEO title and description:** metadata guidance for search previews.
- **Favicon URL:** a public icon URL.
- **Social preview image:** a public Open Graph image URL.
- **Additional CSS instructions:** visual styling guidance for the generator.

Do not publish private contact details or personal information unless you intend them to be public.

## Calendar and community activities

The calendar currently renders 192 scheduled activity cards across 32 daily sessions. Each session occupies a 30-minute slot and contains six activities. Activities cover design, responsive layouts, accessibility, HTML, CSS, JavaScript, SEO, performance, portfolios, and publishing.

The current calendar is a generated programme in the frontend. Its listed credit values are proposed rewards, not a live credit balance. Event registration, attendance verification, server-side event records, and automatic credit grants are not yet connected.

## Documentation and preview limitations

The preview uses a sandboxed iframe and is intended for reviewing the generated HTML. Test links, forms, responsive layouts, and interactive behavior before publishing. Generated code can contain errors and should be reviewed.

## Troubleshooting

- **AI request fails:** check connectivity, try another model, and shorten the prompt.
- **Preview is empty:** request a fresh complete HTML page and check the error shown in the workspace.
- **Publishing fails:** sign in, check the subdomain, and confirm it is not already registered.
- **Cannot edit a project:** sign in with the account that owns the project.
- **Draft missing on another device:** drafts are currently stored only in the browser where they were saved.
- **Published page did not change:** confirm the update succeeded and reload the site in Fairwas.

