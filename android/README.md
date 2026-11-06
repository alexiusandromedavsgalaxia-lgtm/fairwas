# Fairwas for Android

Native Android application written in Kotlin. The Android project is isolated under `android/`; the existing React/Vite web application is unchanged.

## Included native modules

- Android Gradle application (JDK 17, min SDK 26, target SDK 35)
- Native browser shell with address bar, back/forward, reload and home
- HTTC URL normalization and Cloudflare resolver client
- Published-page HTML and Fairwas API response rendering
- HTTC virtual-host resource proxy for GET requests
- Ordered, persistent local history and bookmarks, including migration from the older preference format
- CreatePage developer registration, site listing and basic site creation
- Initial YourCode universal lexer with token positions and structural diagnostics
- Android system-bar insets handling for edge-to-edge layouts
- JVM regression tests for URL normalization and lexer grouping

## Backend configuration

The resolver URL is configurable with the Gradle property `fairwasBaseUrl`. The default remains `https://fairwas.pages.dev`; confirm that this is the actual deployed Fairwas Pages URL before using the app against production.

For a local build, pass the property with:

```bash
gradle -PfairwasBaseUrl=https://YOUR-DEPLOYMENT.example :app:assembleDebug
```

Do not put private API keys or credentials in this property.

## Build and CI

Open this `android/` directory in Android Studio with JDK 17 and sync Gradle. GitHub Actions runs `:app:testDebugUnitTest`, builds `:app:assembleDebug`, uploads the APK artifact, and copies it to the repository's root `app/fairwas-android-debug.apk` path.

The workflow uses an installed Gradle distribution; the repository does not yet include a Gradle Wrapper. A successful workflow run is still required before the APK can be considered verified.

## Known limitations

This is a partial native port, not yet a feature-complete Android equivalent of the web platform.

- Android's `WebResourceRequest` does not expose POST request bodies. The current virtual-host proxy therefore forwards GET resources and explicitly rejects other methods with HTTP 405. Supporting POST requires a separate request bridge or backend-compatible WebView architecture.
- The CreatePage screen currently supports developer registration, listing and basic site creation. A full IDE, project import, update/unpublish/delete UI and deployment history remain outstanding.
- Cloud and Server management, API keys, identity/storage screens, MCP/REST tooling and account/profile flows are not yet ported.
- YourCode is a universal lexical/structural lexer, not a full parser or semantic analyzer for every language.
- Multi-tab/session management, downloads, permissions, browser settings and complete history/bookmark screens remain outstanding.
- Instrumented UI/device tests and an actual successful CI build are still required.

The app reuses the existing Fairwas Cloudflare Pages Functions and D1 services. It does not create a second server-side database or replace the web backend.
