# AJD's Wireless Repairs — Android APK

The Android application wraps the **private admin dashboard** at:
https://repair.jhamal16.workers.dev/index.html

It requires your existing **Supabase admin login**. It also opens the separate
Business Expenses and Planned Purchases pages from the main dashboard.

## Download the APK
- **Latest direct release:** https://github.com/Jhamal96/Repair-Tracker/releases/tag/android-latest
- **Builds and archived artifacts:** https://github.com/Jhamal96/Repair-Tracker/actions/workflows/android-apk.yml
- Click `AJD-Wireless-Repairs-Admin.apk` in the latest release to install.
- If the release is not present yet, open the Actions page, choose
  **Android APK • AJD's Wireless Repairs → Run workflow**, and download the
  workflow artifact after the build completes.

Android may ask you to approve installation of apps from the browser/download
app. Only install an APK you trust. Debug APKs are signed automatically with
the build runner's debug key; repeat downloads may have a different key and
require uninstalling an old APK before installing an updated one.

## Install button behavior
- Inside the APK the install buttons are hidden via the `AJD-Android-App`
  User-Agent marker.
- When the website is opened as an installed PWA in standalone display mode,
  the install button is hidden as well.
- Browser-level install prompts or toolbar badges inside a *regular browser
  tab* are controlled by Chrome/Safari; the site cannot guarantee removal
  of those indicators outside installed mode.

## Functionality
- No browser install nag inside the Android APK.
- Secure Supabase admin sign-in (login is never bypassed).
- Upload product photos through Android's document/photo picker.
- Cloud-based Business Expenses and Planned Purchases.
- An internet connection is required.
- APK downloads are installable debug builds suitable for personal use. For
  distributing updates without reinstalls, configure a persistent signing key
  and release signing in a protected GitHub Actions environment.

## Build locally
Install JDK 17, Android SDK platform 35, and Gradle 8.9:
```sh
gradle -p android assembleDebug
```
Find the APK at `android/app/build/outputs/apk/debug/app-debug.apk`.

## Security
Never put a Supabase service-role key or an Android release signing key in
committed source. Android is a website wrapper; Supabase RLS still controls
access to private records.
