# AJD's Wireless Repairs — Android APK

**[Download Android APK (GitHub Releases)](https://github.com/Jhamal96/Repair-Tracker/releases/download/android-latest/AJD-Wireless-Repairs-Admin.apk)**

Or open **[Releases](https://github.com/Jhamal96/Repair-Tracker/releases)** and select the AJD's Wireless Repairs Android APK.

## Install on Android

1. Open the download link on your Android phone while signed into GitHub (this repository is private).
2. Download **AJD-Wireless-Repairs-Admin.apk**.
3. Approve Android's *Install unknown apps* prompt for your browser and install it.
4. Open the AJD app and sign in with your authorized Supabase administrator credentials.

The app opens the live admin dashboard, including the separate **Business Expenses** and **Planned Purchases** pages. It hides the Install App button inside the APK. Customer information stays in the Supabase cloud database.

## Rebuild the APK

Visit [GitHub Actions: Build AJD Android APK](https://github.com/Jhamal96/Repair-Tracker/actions/workflows/android-apk.yml), choose **Run workflow**, select **main**, and follow the build. The APK appears under **Artifacts** on that run and at the permanent Releases URL once the build succeeds.

## Note on updates and signing

The workflow creates a **debug-signed test APK**. Because cloud build runners may generate new debug signing keys, some updates require uninstalling the previous version before installing a new build. Sign-in details stored inside the app can be lost during uninstall, but repair/finance records already saved in Supabase remain there. For seamless upgrades or Play Store releases, configure a persistent signed release keystore using GitHub Secrets.

You need internet access to use the app.
