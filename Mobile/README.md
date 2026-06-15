# CredPocket Mobile

This is the simplified Expo React Native holder app for the Blockchain-Based Verifiable Credential System capstone.

The mobile app is intentionally limited to:

- Authentication and session persistence
- Local credential vault
- QR scanning for credential claim and verifier requests
- Holder consent before sharing a credential
- Push notification registration and activity history

It does not contain blockchain wallet features, WalletConnect, ethers, Redux, CBOR/UR QR chunk decoding, face recognition, or device-side blockchain verification.

## Start

```bash
cd Mobile
npm install
npx expo start
```

Set the backend and verifier portal origins before running. The app reads Expo public
environment variables first:

```bash
EXPO_PUBLIC_API_URL=https://your-backend.example.com
EXPO_PUBLIC_WEB_URL=https://your-web-verifier.example.com
```

Use URLs that are reachable from the device running the mobile app:

- Physical phone on the same LAN: `EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_LAN_IP:5000`
- Android emulator: `EXPO_PUBLIC_API_URL=http://10.0.2.2:5000`
- iOS simulator: `EXPO_PUBLIC_API_URL=http://localhost:5000`
- Deployed backend/frontend: use the deployed HTTPS URLs

If no environment values are set, the app falls back to a local development URL derived
from the Expo dev-server host when possible, otherwise `10.0.2.2` on Android and
`localhost` on iOS/web. That fallback is for local development only; set
`EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_WEB_URL` for real device testing or deployment.

## Important Backend Contract

The current repository backend exposes `/api/auth/mobile/login`, `/api/auth/mobile/register`, and `/api/auth/mobile/me`.

The older mobile code referenced additional endpoints for OTP, push, verification sessions, and credential claiming. In this clean app those routes are isolated in `constants/config.js` and the `services/` folder so they can be updated without touching screens or state.

See `docs/ARCHITECTURE.md` for the migration plan, dependency cleanup list, and flow diagrams.

