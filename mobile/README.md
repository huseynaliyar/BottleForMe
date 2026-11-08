# BottleForMe mobile

BottleForMe uses React Native and Expo SDK 58 for iOS and Android. Its Give, Radar, Handover, and Profile screens follow the BottleForMe PWA design. The app shares the website’s pickup API, locality list, and validation rules. Email confirmation and password reset links open the website in the phone’s browser.

## Try it for free on a phone

From this directory, run the following in Windows PowerShell or a macOS terminal with Node.js 24:

```sh
npm ci
npx expo login
npm start
```

Install Expo Go on an iPhone or Android device and use the same Wi-Fi network as the computer. For iPhone, sign in to Expo Go with the same Expo account, then scan the terminal’s QR code with the Camera app. On Android, scan from Expo Go. If the local network blocks the connection, try `npx expo start --tunnel`. The device’s Expo Go version must support SDK 58.

If `.env.local` is missing, copy `.env.example` to `.env.local` and fill in the BottleForMe Supabase **publishable** key from the project’s Connect panel. The app can open the public Radar before a key is configured.

The default API and email links use the live site at https://www.bottleforme.com. Use designated test accounts and a staging API with a matching Supabase project to exercise posting and reservations without creating live listings. Pull down on the Radar or My pickups lists to refresh them.

## Check the project

Install dependencies with `npm ci` in the repository root as well as in this directory before type checking the shared code.

```sh
npm run typecheck
npx expo export --platform all
```

Before a standalone Android build, set `BOTTLEFORME_ANDROID_MAPS_API_KEY` to a Maps SDK for Android key restricted to the Android package and the signing certificate’s SHA-1. Expo Go supplies its own map configuration. iOS uses Apple Maps. The bundle identifier and Android package are currently `com.bottleforme.app`; verify availability before registering the store apps.
