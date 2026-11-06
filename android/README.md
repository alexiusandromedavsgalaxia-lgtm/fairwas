# Fairwas for Android

Native Android application written in Kotlin. This project is isolated under `android/` and does not change the existing React/Vite web application.

## Implemented foundation

- Android Studio / Gradle application scaffold
- Native browser address bar and navigation controls
- Kotlin HTTC address normalization and resolver client
- Published-page HTML and Fairwas API response rendering
- HTTC virtual-host resource interception for published assets
- Local browser history and bookmarks
- Back, forward, reload and home controls

Cloudflare Pages Functions remain the backend for site registration, published files, server lookup, CreatePage and database-backed site APIs. The Android app connects to the existing resolver rather than duplicating D1 server logic on the device.

## Build

Open this `android/` directory in Android Studio with JDK 17 and sync Gradle. Build the `app` run configuration.

The default resolver is configured as `https://fairwas.pages.dev` in `app/build.gradle.kts`. Change `FAIRWAS_BASE_URL` if the live Fairwas deployment uses another URL.

## Remaining native modules

This is the first Android foundation, not a completed port of every web feature. The next modules to implement are CreatePage project management and editor, Cloud and Server management, YourCode's universal parser and Tree-sitter grammars, account flows, full multi-tab/session management, downloads and MCP/REST developer tooling.
