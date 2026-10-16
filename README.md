# Jutumasin

Estonian conversation card game, available as a static website and an offline-capable Android app.

## Company privacy page

The main page remains the game. Its About section links to the company privacy subpage; the privacy page has no link back to the game. The absolute HTTPS link also works from the Android app by opening the public page in a browser.

`privacy.html` and `privacy.css` are a standalone Chatmachine OÜ company privacy page, with independent branding and no game navigation or app-specific policy content. They use the existing static deployment at `https://jutumasin.com/privacy.html`; no build step is required. This page describes only its own website data practices and is not the Android app's privacy policy.

## Android

- Package: `com.jutumasin.app`; Android 7.0 (API 24) or newer.
- The existing website assets are bundled at build time; no website connection is needed to play.
- Live AdMob IDs are configured in `android/app/build.gradle` for **all build types**, as requested.
- A native ad card is offered after 3 newly completed questions, then 4, repeating. Question cards are never removed. Revisited questions and history/favourites browsing do not count. Switching decks retains the cadence; it also survives app restarts.
- Ads contain Ad attribution, SDK-managed AdChoices and a separate Continue button. Ad clicks are handled only by Google's native SDK. No-fill, offline and consent-unavailable cases continue gameplay immediately. Ads are not saved in history or favourites.
- UMP requests consent information at launch before ad initialization. When required, privacy options appear on the About screen. Configure your privacy messages and privacy policy in AdMob's Privacy & messaging page for your app. Account approval and ad inventory determine whether Google actually serves an ad.
- Progress, history and favourites stay in local WebView storage. Android Back returns to the menu; from the menu it exits. External HTTPS links open in the browser.

## Build

This workspace includes a ready-to-upload signed bundle at `../../Jutumasin-Android/Jutumasin.aab`. Double-click `../../Jutumasin-Android/Test Android.bat` to launch the matching release APK in a visible Android emulator. Run that batch file with `-Rebuild` to rebuild the bundle and APK, run lint, and launch the updated app. It uses the local `.tools` directory, preserves emulator app data, and reports build/startup errors without removing an existing installation.

Install JDK 17 and Android SDK platform 36. Point `android/local.properties` at the SDK (`sdk.dir=C\:/path/to/android-sdk` on Windows), or set `ANDROID_HOME`. From `android`:

```powershell
.\gradlew.bat assembleDebug lintDebug
.\gradlew.bat assembleRelease bundleRelease
.\gradlew.bat connectedDebugAndroidTest
```

The last command requires a running Android emulator/device. Outputs are under `android/app/build/outputs/`. The release APK is installable; the release AAB is for Google Play upload.

A release signing key was generated locally in `android/jutumasin-release.jks`; its configuration is in `android/signing.properties`. Both are excluded from Git. **Back up both privately** and retain them for future updates. A fresh checkout needs that signing configuration to produce signed releases. Never commit or distribute these files with the app.

Example signing configuration (supply your own values on another machine):

```properties
storeFile=jutumasin-release.jks
storePassword=YOUR_PRIVATE_PASSWORD
keyAlias=jutumasin
keyPassword=YOUR_PRIVATE_PASSWORD
```

Release identity is defined once in `version.js`: `date` uses DDMMYYYY (Europe/Tallinn), `build` is the build number for that date, and `code` is the ever-increasing Google Play version code. The menu, About screen and Android version name all show `vDDMMYYYY build N`. For the next release on the same date, increment `build` and `code`; on a new date, change `date`, reset `build` to 1 and increment `code`. Rebuilding the same release does not silently change its identity. Play publication, store listing, content rating, data safety declarations, privacy policy hosting and AdMob account setup are separate from building the app.

## Tests

With Node.js and Google Chrome installed:

```powershell
npm install
npm test
```

The Node tests verify the 3/4 cadence, backtracking, deck changes and restart. Browser tests exercise navigation, native-ad bridge callbacks, rapid taps, cancelling transitions, favourites, persistence, all MIX decks, completion and small/landscape layouts. They mock the native bridge and never click real ads. Android instrumentation verifies bundled assets, navigation, persistence and the real native bridge's skip path. Live ad delivery is not guaranteed by these tests.

## Source

Android launcher icons and splash artwork are resized from the website's `assets/logo.png`. Run `npm run android:branding` after replacing that artwork, then rebuild Android. The startup screen uses the full wordmark; adaptive and legacy app icons use the speech-bubble/heart symbol. The splash remains until the bundled menu is ready to draw, independently of ad loading.

`index.html`, `style.css`, `game.js`, `decks.js` and `ad-cadence.js` are the shared game. `android/` contains the native app, ad renderer and consent integration. The static website keeps working without the Android bridge.
