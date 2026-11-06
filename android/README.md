# Fairwas for Android

Android application written in Kotlin. The Android browser shell is native; the CreatePage and YourCode workspaces use the **real Fairwas React application**, not reduced Kotlin mock screens.

## Android shell

- Native phone-first browser chrome, address bar, navigation, history and bookmarks
- HTTC URL normalization and Cloudflare resolver client
- Published-page HTML and virtual-host GET resource proxy
- Edge-to-edge/system-bar handling and mobile keyboard resizing
- JVM regression tests for URL normalization and the legacy language-neutral lexer

## Real CreatePage and YourCode workspaces

When the user opens `httc://createpage.fair`, `httc://yourcode.official`, or `httc://yourcode.createpage.fair`, Android opens the workspace activity and loads the configured Fairwas web deployment.

The activity initializes the original Fairwas browser state (`fairwas:v1`) to the requested HTTC workspace URL, then loads the deployed React application. This runs the existing components and backend integration, including:

- CreatePage developer registration, dashboard, site/project management and publishing
- Visual Studio and the full web IDE, file/folder management, code editing, preview and local drafts
- Project import, static-site migration, publishing and update flows supported by the web backend
- CreatePage databases, API endpoints, servers, workers and account/profile screens present in the web app
- YourCode's actual workspace, project list, editor, original language/runtime integration and preview

The Android activity applies phone-specific CSS to the real workspace: narrow navigation, vertically stacked forms, scrollable toolbars, compact file tree/editor layout and a single-column YourCode editor/preview flow. It does not replace the React components or their API with placeholder implementations.

**Network/deployment requirement:** these workspaces are loaded from `FAIRWAS_BASE_URL`, so the device needs internet access and that URL must serve the current Fairwas web app and its `/api/*` functions. They are not bundled for offline use. The default remains `https://fairwas.pages.dev`; verify that this is the correct production deployment URL.

## Backend configuration

The resolver and workspace URL are configurable with the Gradle property `fairwasBaseUrl`.

```bash
gradle -PfairwasBaseUrl=https://YOUR-DEPLOYMENT.example :app:assembleDebug
```

Do not put private API keys or credentials in this property.

## Build and CI

Open this `android/` directory in Android Studio with JDK 17 and sync Gradle. GitHub Actions runs `:app:testDebugUnitTest`, builds `:app:assembleDebug`, uploads the APK artifact, and copies it to the repository's root `app/fairwas-android-debug.apk` path.

The workflow uses an installed Gradle distribution; the repository does not yet include a Gradle Wrapper. A successful workflow run is required before the APK can be considered verified.

## Remaining Android limitations

- The core Fairwas web workspace is real, but it currently runs in an online WebView rather than being bundled as an offline Android feature.
- The native browser's HTTC resource interception still forwards GET requests only. Android's `WebResourceRequest` does not expose request bodies, so POST/PUT/PATCH/DELETE resource requests require a separate bridge. The CreatePage workspace's own same-origin `/api/*` requests are not subject to that GET-only HTTC asset proxy.
- Browser features such as native multi-window tabs, downloads and Android-specific permissions still need further work.
- Instrumented tests on actual Android phones are still required.

The app reuses the existing Fairwas Cloudflare Pages Functions and D1 services. It does not create a second server-side database or replace the web backend.
