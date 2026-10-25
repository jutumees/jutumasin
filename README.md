# Jutumasin

Website: https://jutumasin.com/

The workspace has exactly three top-level folders:

- `code/` — this Git repository: website, Android source, tests and build scripts.
- `releases/` — signed `Jutumasin.apk` for installation and `Jutumasin.aab` for Google Play.
- `tools/` — SDK, JDK, emulator, caches, generated build files, private signing files and design/store artwork. This folder is outside Git.

## Build and test

From `code/`, run `Build Android.bat` to build the signed APK and AAB and run Android release lint. Both outputs are copied to `../releases/` only after a successful build. `Test Android.bat` opens the emulator and installs the release APK. `Test Android.bat -Rebuild` rebuilds before launching.

The build uses `../tools/gradle-8.13`, `../tools/jdk-17.0.18+8` and `../tools/android-sdk`. Keep the private keystore and signing.properties in `../tools/signing/`; back these up securely. Never commit them. Build output and Gradle project caches stay in `../tools/`.

Run `npm test` with Node.js, Playwright and Chrome installed for browser tests. `node tests/card-idea-live.cjs` is a separate manual test that sends one clearly labelled message to the configured Discord webhook; normal tests mock delivery.

## Releases

For each release, update `version.js` with the date (DDMMYYYY) and increment both `build` and Android `code`. Then run `node scripts/version-assets.cjs` to refresh browser asset hashes. Build the signed artifacts, run tests, and commit the source and updated HTML together. The website and Android package use the same release identity.

## AdSense

The GitHub Pages publishing root is this repository (`code/` locally). `ads.txt` and `app-ads.txt` must stay at the repository root, not inside another website directory. The domain is configured in `CNAME`.

`index.html` includes the AdSense account meta tag. `web-ads.js` loads the publisher's adsbygoogle.js script once, only for jutumasin.com and www.jutumasin.com, and requests ads after the consent callback. It is disabled in the Android WebView, which uses AdMob.

After publishing, check https://jutumasin.com/ads.txt and https://www.jutumasin.com/ads.txt return HTTP 200 and the publisher line. AdSense's dashboard status can lag behind the live file; request a fresh check in AdSense when available.
