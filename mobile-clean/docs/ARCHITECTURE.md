# BVCS Mobile Clean Architecture

This document explains the clean rebuild for the Expo React Native mobile app. The goal is a simple holder wallet that is easy to explain during capstone defense.

## 1. Current Architecture Problems

The legacy mobile app grew beyond the final capstone scope.

Main problems:

- The root layout owns too much behavior: Redux provider, wallet bootstrap, session polling, global consent modal, toast setup, and navigation all live in one file.
- State is split across Redux slices, Zustand wallet store, AsyncStorage, refs, and component state. This makes bugs hard to trace.
- Blockchain concerns leaked into the mobile app through `ethers`, polyfills, Buffer globals, anchoring status sync, explorer links, and QR payload decoding.
- QR scanning became a transport protocol implementation through BC-UR, CBOR, CBORG, pako, repeat-frame tracking, and claim queues.
- Verification consent exists in several places: Redux session slice, consent slice, consent modal slice, layout watcher, share page, and QR flow.
- Native complexity is high: Vision Camera, face detector, worklets, Skia, Expo GL, image manipulation, custom Kotlin plugin, and liveness flows.
- Authentication is coupled to account verification, biometrics, request routing, notification refresh, and setup screens.
- There are duplicate files and concepts: `toast.js` and `toast.jsx`, multiple face verifier files, multiple verification services, and unused routes.
- Backend URLs are scattered and sometimes inconsistent, making API migration risky.

## 2. What Is Unnecessary And Why

Remove these from the mobile client:

- WalletConnect and external wallet support: final app is not a blockchain wallet.
- `ethers` and blockchain polyfills: backend owns blockchain anchoring and verification.
- BC-UR, CBOR, CBORG, pako QR chunk decoding: capstone QR flows can use simple URLs or JSON payloads.
- Redux Toolkit: the state surface is small enough for Zustand.
- Complex session watchers and global polling: consent should open from QR or push notification.
- Face recognition and liveness: not part of the final stated mobile purpose.
- Account setup and KYC flow: not part of the final holder-wallet scope unless the defense explicitly requires it.
- Device-side anchoring sync and explorer links: those are backend/admin concerns.
- Biometric saved email/password login: it complicates auth and stores sensitive credentials.

## 3. Proposed New Structure

```text
mobile-clean/
  app/
    (auth)/
      login.jsx
      register.jsx
      verify-email.jsx
      reset-password.jsx
      _layout.jsx
    (tabs)/
      home.jsx
      wallet.jsx
      scan.jsx
      activity.jsx
      settings.jsx
      _layout.jsx
    vc/
      [id].jsx
      share.jsx
    verification/
      consent.jsx
    _layout.jsx
    index.jsx
  components/
    ui/
    vc/
    qr/
    notifications/
  constants/
    config.js
    theme.js
  hooks/
    useBootstrap.js
    useNotifications.js
  services/
    apiClient.js
    authService.js
    vcService.js
    verificationService.js
    notificationService.js
  store/
    useAppStore.js
  utils/
    credentialUtils.js
    qrParser.js
    storage.js
  docs/
    ARCHITECTURE.md
```

Boundary rules:

- `app/` contains routes and screen-level UI only.
- `components/` contains reusable presentational pieces.
- `services/` contains backend calls and local credential persistence operations.
- `store/useAppStore.js` coordinates app state and service calls.
- `utils/` contains pure helpers: storage, QR parsing, credential normalization.
- `constants/config.js` is the only place that should know endpoint paths.

## 4. Migration Plan

1. Create `mobile-clean/` and keep the old mobile app as read-only reference.
2. Copy only visual assets that are still useful: logo, app icon, and any credential placeholder images.
3. Implement auth against `/api/auth/mobile/login`, `/api/auth/mobile/register`, and `/api/auth/mobile/me`.
4. Add or align backend OTP routes used by `authService.js`.
5. Replace the old wallet store with `vcService.js` plus `useAppStore.js`.
6. Replace old QR scan logic with `parseQrPayload()`.
7. Replace global verification polling with explicit routes:
   - QR scan -> `verification/consent`
   - Push tap -> `verification/consent`
8. Move notification registration to `useNotifications()`.
9. Remove Redux, WalletConnect, blockchain, face-recognition, and QR chunk dependencies.
10. Run the clean app and test only five defense-critical flows: auth, wallet, scan, consent, notifications.

## 5. Files To Delete Or Deprecate From Legacy Mobile

Deprecate these folders/files after the clean app is validated:

```text
polyfills.js
app.plugin.js
redux_store/
features/session/
features/consent/
features/notif/
features/photo/
features/verification/
features/vc/
assets/store/walletStore.js
assets/components/scan.jsx
assets/components/faceVerifier.jsx
lib/urDecoder.jsx
lib/claimQueue.js
lib/faceRecognition.jsx
lib/faceVerifier.jsx
utils/walletAutoConnect.jsx
app/(setup)/
app/subs/home/request_vc.jsx
app/subs/vc/request.jsx
```

Rewrite or replace these instead of carrying them forward:

```text
app/_layout.jsx
app/(main)/_layout.jsx
app/(main)/vc.jsx
app/subs/vc/detail.jsx
app/subs/vc/share.jsx
app/(auth)/*
```

Clean duplicates:

```text
assets/components/toast.js
assets/components/toast.jsx
```

## 6. Dependency Cleanup

Remove from the clean mobile app:

```text
@reduxjs/toolkit
react-redux
ethers
@ngraveio/bc-ur
cbor
cborg
pako
buffer
stream
react-native-get-random-values
react-native-url-polyfill
react-native-vision-camera
react-native-vision-camera-face-detector
react-native-worklets
react-native-worklets-core
@shopify/react-native-skia
expo-gl
expo-image-manipulator
expo-image-picker
expo-media-library
expo-local-authentication
react-native-image-colors
react-native-keyboard-aware-scroll-view
react-native-modal
@react-native-picker/picker
@react-native-community/netinfo
uuid
```

Keep only what the final mobile scope needs:

```text
expo
expo-router
expo-camera
expo-notifications
expo-device
expo-constants
expo-secure-store
expo-status-bar
@react-native-async-storage/async-storage
@expo/vector-icons
axios
zustand
react-native-qrcode-svg
react-native-svg
react-native-safe-area-context
react-native-screens
react-native-gesture-handler
@react-navigation/native
@react-navigation/bottom-tabs
react
react-native
```

Note: `expo-secure-store` is used only for the auth token. Credentials and activity history remain AsyncStorage-based for simplicity.

## 7. State Management Decision

Use Zustand, not Redux.

Why:

- The app has a small state surface: user, credentials, active verification request, notifications, loading flags.
- Async actions can live directly in the store without slices, thunks, action types, or selectors.
- Feature boundaries stay readable through services instead of Redux orchestration.
- It is easier to defend: "screens call store actions; store calls services; services call backend or storage."

Redux is justified only if the app grows into a multi-role enterprise client with deep offline sync, optimistic updates, and many independent state domains. That is outside this capstone mobile scope.

## 8. Flow Diagrams

### Auth Flow

```text
App opens
  -> useBootstrap()
  -> load token from SecureStore
  -> load user from AsyncStorage
  -> if token exists: go to tabs/home
  -> else: go to auth/login

Register
  -> enter username/email/password
  -> request email OTP
  -> verify OTP
  -> register mobile account
  -> save token/user
  -> go to tabs/home

Login
  -> submit email/password
  -> backend returns token/user
  -> token saved in SecureStore
  -> user saved in AsyncStorage
  -> go to tabs/home

Logout
  -> call /auth/logout
  -> clear SecureStore token
  -> clear local user/session
  -> go to auth/login
```

### VC Wallet Flow

```text
Wallet tab opens
  -> load credentials from AsyncStorage
  -> display CredentialCard list

Credential detail
  -> open /vc/[id]
  -> show metadata and raw credential JSON
  -> user can delete local copy
  -> user can open share screen

Share credential
  -> open /vc/share?id=...
  -> render QR or native share sheet
  -> verifier receives only what the user intentionally shares
```

### QR Scan Flow

```text
Scan tab opens
  -> camera reads QR
  -> parseQrPayload(raw)

If verification request:
  -> navigate to /verification/consent?sessionId=...

If credential or claim URL:
  -> claimCredential()
  -> save credential locally
  -> open /vc/[id]

If unknown:
  -> show unsupported QR message
```

### Verification Consent Flow

```text
Consent screen opens with sessionId
  -> GET verification session
  -> display organization, contact, and purpose
  -> load local credentials
  -> holder chooses credential

Approve
  -> POST selected credential to present endpoint
  -> backend performs validation/blockchain checks
  -> save activity item
  -> return to Activity

Deny
  -> POST deny decision
  -> save activity item
  -> return to Activity
```

### Notifications Flow

```text
User is authenticated
  -> request push permission
  -> get Expo push token
  -> POST token to backend

Foreground push
  -> show notification
  -> save local activity

User taps push
  -> inspect notification data
  -> if sessionId exists: open consent screen
  -> else if credentialId exists: open credential detail
  -> else: open Activity
```

## 9. Backend Endpoint Contract To Confirm

The clean app currently expects these routes in `constants/config.js`:

```text
POST /api/auth/mobile/login
POST /api/auth/mobile/register
GET  /api/auth/mobile/me
POST /api/auth/logout

POST /api/auth/mobile/otp/request
POST /api/auth/mobile/otp/verify
POST /api/auth/mobile/password/forgot
POST /api/auth/mobile/password/verify
POST /api/auth/mobile/password/reset

GET  /api/mobile/credentials
POST /api/mobile/credentials/claim

POST /api/verification/session
GET  /api/verification/session/:sessionId
POST /api/verification/session/:sessionId/present

POST /api/push/register
GET  /api/mobile/notifications
```

If the backend uses different names, update `ENDPOINTS` only. Do not change screens.

## 10. Defense Summary

The final mobile app is no longer a blockchain node, wallet connector, KYC client, face recognition client, or verification engine.

It is a holder-controlled credential wallet:

- stores credentials locally,
- receives verification requests,
- asks consent,
- sends credentials to the backend,
- records user-visible activity.

That is the simplest architecture that still proves the BVCS capstone flow.
