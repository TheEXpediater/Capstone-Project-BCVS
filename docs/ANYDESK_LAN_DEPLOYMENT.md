# BCVS AnyDesk LAN Deployment Guide

This guide sets up the BCVS registrar API, web MIS, MongoDB, and Expo development APK on a Windows university workstation. LAN mode works without Namecheap or public DNS.

## MongoDB Setup

Install MongoDB Community Server and run it as a Windows service.

```powershell
winget install --id MongoDB.Server -e
Get-Service MongoDB
Start-Service MongoDB
```

BCVS uses MongoDB/Mongoose only. It expects three databases:

```text
bcvs_identity
bcvs_credentials
bcvs_platform
```

## Server `.env`

Create `server\.env`. Replace `SERVER_IP_HERE` with the workstation LAN IP if you want fixed LAN URLs in CORS or web base settings.

```env
NODE_ENV=development
PORT=5000
WEB_PORT=5173

MONGO_URI_IDENTITY=mongodb://127.0.0.1:27017/bcvs_identity
MONGO_URI_CREDENTIALS=mongodb://127.0.0.1:27017/bcvs_credentials
MONGO_URI_PLATFORM=mongodb://127.0.0.1:27017/bcvs_platform

JWT_SECRET=change_this_to_a_long_random_secret
JWT_EXPIRES_IN=1d
BCRYPT_SALT_ROUNDS=10
KEY_ENCRYPTION_SECRET=change_this_to_another_long_random_secret

CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://SERVER_IP_HERE:5173,https://psau-credentials.cfd
WEB_BASE_URL=http://SERVER_IP_HERE:5173

PUBLIC_DOMAIN=psau-credentials.cfd
DOMAIN_API_BASE_URL=https://psau-credentials.cfd/api
DOMAIN_WEB_BASE_URL=https://psau-credentials.cfd
VERIFICATION_WEB_BASE_URL=https://psau-credentials.cfd
PREFERRED_DEPLOYMENT_MODE=lan

DISCOVERY_ENABLED=false
DISCOVERY_SERVICE_NAME=BCVS Registrar Server
DISCOVERY_SERVICE_TYPE=bcvs-api
DISCOVERY_SERVICE_PROTOCOL=tcp

RPC_URL=
CONTRACT_OPERATOR_PRIVATE_KEY=
ANCHOR_CHAIN_ID=80002
ANCHOR_CONFIRMATIONS=2
```

Domain values are optional. If the domain does not resolve, LAN mode still works. Discovery is disabled by default and should be enabled only by MIS/developers during testing.

## Install Dependencies

```powershell
cd C:\Capstone-Project-BCVS\server
npm install

cd C:\Capstone-Project-BCVS\client
npm install

cd C:\Capstone-Project-BCVS\Mobile
npm install
```

## LAN IP Setup

Find the workstation LAN IP:

```powershell
ipconfig
```

Open firewall ports:

```powershell
netsh advfirewall firewall add rule name="BCVS API 5000" dir=in action=allow protocol=TCP localport=5000
netsh advfirewall firewall add rule name="BCVS Web 5173" dir=in action=allow protocol=TCP localport=5173
```

Run the API:

```powershell
cd C:\Capstone-Project-BCVS\server
npm run dev
```

Run the web MIS:

```powershell
cd C:\Capstone-Project-BCVS\client
npm run dev -- --host 0.0.0.0 --port 5173
```

Open:

```text
http://SERVER_IP_HERE:5173
```

## Network Endpoints

Health:

```text
http://SERVER_IP_HERE:5000/api/health
```

Network discovery payload:

```text
http://SERVER_IP_HERE:5000/api/network-info
```

Mobile QR pairing payload:

```text
http://SERVER_IP_HERE:5000/api/network-qr
```

These endpoints expose LAN API/web URL candidates, optional domain URLs, preferred mode, discovery status, and QR pairing data. They do not expose passwords, tokens, keys, or secrets.

## MIS QR Pairing

In the web MIS, sign in as `developer` or `super_admin`, then open:

```text
System Settings -> Network & Mobile
```

Use this panel to:

- Review detected LAN IPv4 addresses.
- Copy suggested LAN API and web URLs.
- Configure optional domain API/web URLs.
- Choose LAN or DOMAIN as the preferred mode.
- Test `/api/health`.
- Save network settings.
- Show the mobile pairing QR code from `/api/network-qr`.

This QR code is the primary mobile connection method for university LAN use.

## Mobile Scan Setup

Install the Expo development APK, open the mobile app, and scan the MIS pairing QR from the main Scan tab or the Settings tab.

When the QR payload has `type: "BCVS_SERVER_CONFIG"`, the app:

- Selects LAN or domain URL based on `preferred`.
- Normalizes the API URL to include `/api`.
- Validates `/api/health`.
- Saves the QR server config.
- Refreshes the active API base URL.
- Uses the saved server without rebuilding the APK.

Credential claim QR codes and verification QR codes remain separate flows. The app only treats a QR as server setup when the JSON payload clearly contains:

```json
{
  "type": "BCVS_SERVER_CONFIG",
  "system": "BCVS"
}
```

## Manual IP Fallback

If QR pairing is unavailable, open mobile Settings, Server tab, and enter one of:

```text
192.168.1.50
192.168.1.50:5000
http://192.168.1.50:5000
http://192.168.1.50:5000/api
https://psau-credentials.cfd
https://psau-credentials.cfd/api
```

The app normalizes LAN input to:

```text
http://192.168.1.50:5000/api
```

The app normalizes domain input to:

```text
https://psau-credentials.cfd/api
```

Startup fallback order is saved QR config, saved manual config, configured domain if healthy, then development fallback from `EXPO_PUBLIC_API_URL`. mDNS discovery is not part of normal student startup.

## Domain Fallback

`psau-credentials.cfd` is optional. If configured and reachable, verifier links prefer the domain. If it is missing or unreachable, the system still uses LAN URLs.

Generated verifier links prefer:

```text
VERIFICATION_WEB_BASE_URL
DOMAIN_WEB_BASE_URL or PUBLIC_DOMAIN
persisted System Settings domain web URL
WEB_BASE_URL
LAN web URL
localhost development fallback
```

The verifier portal route remains available at:

```text
/verify
/verify/:sessionId
/verification-portal/verify
/verification-portal/verify/:sessionId
```

## Namecheap DNS Limitation

Namecheap DNS alone cannot expose a LAN-only computer to the internet. Public domain mode requires a public host, reverse proxy, tunnel, static public IP with port forwarding, or hosting provider with HTTPS termination.

## Expo Dev APK Only

The mobile project is configured for Expo development APK builds only.

```powershell
cd C:\Capstone-Project-BCVS\Mobile
npm run dev:client
npm run android:dev
npm run build:dev
```

Exact APK build command:

```powershell
eas build --profile development --platform android
```

There are no preview, production, AAB, or CI/CD mobile build profiles.

## mDNS/Zeroconf Limitation

mDNS/Zeroconf advertises `_bcvs-api._tcp.local` only when discovery is enabled and `bonjour-service` is available. It is for developer/testing use only. University Wi-Fi may block multicast or isolate VLANs, so students should not use discovery tools. QR pairing and manual setup are the reliable paths.

## Action Logs Usage

Open:

```text
System Settings -> Action Logs
```

Only `developer` and `super_admin` can view or delete audit logs. Logs include web login, mobile login, user creation, credential draft actions, payment confirmation, claim QR generation, mobile credential request/claim, verification create/check/approve/deny, settings updates, and network setting updates.

The Action Logs table now uses readable action labels, search by default, a filter/settings modal for module, actor type, role, date range, and status, plus detail view, single delete, bulk delete, and pagination.

## Audit Retention and Deletion Guidance

Audit logs are operational records. Delete only for cleanup, storage management, or approved retention policy work. Before bulk delete, export or back up records if the logs are needed for MIS review. Sensitive fields such as passwords, tokens, Authorization headers, private keys, ciphertext, and secrets are redacted before storage.

## Troubleshooting

- If `npm` is blocked in PowerShell, run `npm.cmd`.
- If the phone cannot connect, verify both devices are on the same LAN/VLAN and Windows Firewall allows ports 5000 and 5173.
- If a QR scan says network error, check that the server is running, the phone and server are on the same Wi-Fi, Windows Firewall allows port 5000, and `http://SERVER_IP_HERE:5000/api/health` returns `system: "BCVS"` and `service: "bcvs-api"`.
- If QR pairing fails, use manual server setup in the mobile Settings tab with the workstation LAN IP.
- If auto-discovery fails during developer testing, assume multicast is blocked and use QR/manual setup.
- If backend startup fails, check `server\.env`, MongoDB service status, and port conflicts.
- If blockchain anchoring fails because env or contract settings are missing, credential proof preparation should fail gracefully rather than crashing the API.
