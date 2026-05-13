# CredPocket Mobile Clean

This is the simplified Expo React Native holder app for the Blockchain-Based Verifiable Credential System capstone.

The mobile app is intentionally limited to:

- Authentication and session persistence
- Local credential wallet
- QR scanning for credential claim and verifier requests
- Holder consent before sharing a credential
- Push notification registration and activity history

It does not contain blockchain wallet code, WalletConnect, ethers, Redux, CBOR/UR QR chunk decoding, face recognition, or device-side blockchain verification.

## Start

```bash
cd mobile-clean
npm install
npx expo start
```

Set the backend origin before running:

```bash
EXPO_PUBLIC_API_URL=https://your-backend.example.com
EXPO_PUBLIC_WEB_BASE=https://your-web-verifier.example.com/verification-portal
```

## Important Backend Contract

The current repository backend exposes `/api/auth/mobile/login`, `/api/auth/mobile/register`, and `/api/auth/mobile/me`.

The older mobile code referenced additional endpoints for OTP, push, verification sessions, and credential claiming. In this clean app those routes are isolated in `constants/config.js` and the `services/` folder so they can be updated without touching screens or state.

See `docs/ARCHITECTURE.md` for the migration plan, dependency cleanup list, and flow diagrams.

