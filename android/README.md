# Fairwas for Android

Native Android application written in Kotlin. This project is isolated under `android/`; the existing React/Vite web application is unchanged.

## Native modules in this branch

- Android Studio / Gradle application scaffold (JDK 17, min SDK 26)
- Native browser activity with address bar, back/forward, reload and home
- Kotlin HTTC address normalization and resolver client
- Published-page HTML and Fairwas API response rendering
- HTTC virtual-host resource routing through the existing Cloudflare resolver
- Persistent local history and bookmarks
- CreatePage client and native dashboard for developer registration, site listing and basic site creation
- Initial Kotlin YourCode universal lexer with token positions and structural diagnostics

## Backend integration

The app reuses the existing Cloudflare Pages Functions and D1 services for HTTC resolution and CreatePage. It does not duplicate the server's database, publishing, identity or routing logic locally.

The resolver URL is configured through `FAIRWAS_BASE_URL` in `app/build.gradle.kts`. The current default is `https://fairwas.pages.dev`; replace it with the actual deployed Fairwas Pages URL if different.

## Build

Open this `android/` directory in Android Studio with JDK 17 and sync Gradle. Build the `app` run configuration. This repository branch does not yet include a Gradle wrapper, and a local Android build has not been run as part of this initial port.

## Remaining port

This is an initial native foundation, not yet a feature-complete Android equivalent of the web platform. Remaining work includes:

1. Full CreatePage IDE: file tree, code editor, project import, publish/update/unpublish/delete and deployment history.
2. Cloud and Server management, API routes, keys, identity and storage UI.
3. Full YourCode editor, language detection, Tree-sitter WASM-equivalent native parsers and diagnostics.
4. Multi-tab/session management, downloads, permissions, browser settings and complete bookmark/history screens.
5. MCP/REST developer tooling and account/profile flows.
6. Instrumented tests, parser tests, Gradle wrapper and an actual debug/release build.

The universal Kotlin lexer only reports lexical and structural information for unknown languages. It does not claim to understand the semantics of an arbitrary invented language.
