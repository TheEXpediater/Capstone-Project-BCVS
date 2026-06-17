# BCVS AnyDesk LAN Deployment Guide

This guide is for setting up the BCVS registrar server, web MIS client, and Expo development APK on a Windows university workstation through AnyDesk. Local LAN deployment does not require a public domain.

## 1. Install Git

Download and install Git for Windows:

```powershell
winget install --id Git.Git -e
git --version
```

## 2. Install Node.js LTS

Install the current Node.js LTS build from nodejs.org or with winget:

```powershell
winget install --id OpenJS.NodeJS.LTS -e
node -v
npm -v
```

If PowerShell blocks npm scripts, use `npm.cmd` instead of `npm`.

## 3. Install MongoDB Community Server

Install MongoDB Community Server for Windows and select the option to run MongoDB as a Windows service.

```powershell
winget install --id MongoDB.Server -e
```

## 4. Verify MongoDB Service

Open PowerShell as Administrator:

```powershell
Get-Service MongoDB
Start-Service MongoDB
```

MongoDB should show `Running`.

## 5. Optional Compass and mongosh

MongoDB Compass is a GUI for viewing databases and records. `mongosh` is the command-line shell for MongoDB. They are helpful for inspection, but the BCVS seed script can run without Compass.

## 6. Clone the Repository

```powershell
cd C:\
git clone REPOSITORY_URL Capstone-Project-BCVS
cd C:\Capstone-Project-BCVS
```

## 7. Create `server\.env`

Create `server\.env` and replace `SERVER_IP_HERE` with the workstation LAN IP.

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
VERIFICATION_WEB_BASE_URL=https://psau-credentials.cfd

PUBLIC_DOMAIN=psau-credentials.cfd
DOMAIN_API_BASE_URL=https://psau-credentials.cfd/api
DOMAIN_WEB_BASE_URL=https://psau-credentials.cfd
PREFERRED_DEPLOYMENT_MODE=lan

DISCOVERY_ENABLED=true
DISCOVERY_SERVICE_NAME=BCVS Registrar Server
DISCOVERY_SERVICE_TYPE=bcvs-api
DISCOVERY_SERVICE_PROTOCOL=tcp

RPC_URL=
CONTRACT_OPERATOR_PRIVATE_KEY=
ANCHOR_CHAIN_ID=80002
ANCHOR_CONFIRMATIONS=2
```

For LAN-only development, domain values may remain present but do not need to resolve publicly.

## 8. Install Server Dependencies

```powershell
cd C:\Capstone-Project-BCVS\server
npm install
```

Use `npm.cmd install` if PowerShell blocks `npm`.

## 9. Install Client Dependencies

```powershell
cd C:\Capstone-Project-BCVS\client
npm install
```

## 10. Install Mobile Dependencies

```powershell
cd C:\Capstone-Project-BCVS\Mobile
npm install
```

## 11. Place Curriculum JSON Files

Curriculum files must be in:

```text
server/src/script/curricula/input
```

Expected files:

```text
DVM_Curriculum.json
BSIT_Curriculum.json
BSABE_Curriculum.json
BSCE_Curriculum.json
BSCpE_Curriculum.json
BSED_Curriculum.json
BSGE_Curriculum.json
BTLED_Curriculum.json
```

## 12. Run the Seed Command

```powershell
cd C:\Capstone-Project-BCVS\server
npm run seed:registrar -- --curriculumYear 2021 --studentsPerProgram 100 --startSerial 864 --schoolYear 2025-2026
```

Clean reset deletes only demo records marked with `seedMeta.source=registrar-demo-seed` and the selected `seedMeta.curriculumYear`:

```powershell
cd C:\Capstone-Project-BCVS\server
npm run seed:registrar -- --curriculumYear 2021 --studentsPerProgram 100 --startSerial 864 --schoolYear 2025-2026 --reset true
```

Default web users:

```text
mis@bcvs.local / ChangeMe123! / developer
registrar@bcvs.local / ChangeMe123! / super_admin
admin@bcvs.local / ChangeMe123! / admin
cashier@bcvs.local / ChangeMe123! / cashier
```

## 13. Run the Backend

```powershell
cd C:\Capstone-Project-BCVS\server
npm run dev
```

Health checks:

```text
http://SERVER_IP_HERE:5000/api/health
http://SERVER_IP_HERE:5000/api/network-info
```

## 14. Run the Web Client

```powershell
cd C:\Capstone-Project-BCVS\client
npm run dev -- --host 0.0.0.0 --port 5173
```

Open:

```text
http://SERVER_IP_HERE:5173
```

## 15. Open Windows Firewall Ports

Run PowerShell as Administrator:

```powershell
netsh advfirewall firewall add rule name="BCVS API 5000" dir=in action=allow protocol=TCP localport=5000
netsh advfirewall firewall add rule name="BCVS Web 5173" dir=in action=allow protocol=TCP localport=5173
```

## 16. Build the Development APK

The mobile app uses an Expo development build only.

```powershell
cd C:\Capstone-Project-BCVS\Mobile
npm run build:dev
```

Equivalent command:

```powershell
eas build --profile development --platform android
```

## 17. Install APK on a Physical Android Phone

Download the APK from EAS, transfer it to the phone, and install it. Allow Android to install from the selected file manager or browser when prompted.

## 18. Run Metro With Dev Client

Keep the phone and server on the same LAN/VLAN.

```powershell
cd C:\Capstone-Project-BCVS\Mobile
npm run dev:client
```

Open the installed BCVS development app and connect it to the Metro session.

## 19. Connect the Mobile App to the Server

In the MIS web client, open `System Settings` then `Network & Mobile`. Use the Network & Mobile Connection panel to scan the QR code with the phone.

Fallback options:

```text
Manual API URL: http://SERVER_IP_HERE:5000/api
Manual web URL: http://SERVER_IP_HERE:5173
```

mDNS/Zeroconf may fail on university Wi-Fi if multicast traffic is blocked or if the phone and server are on different VLANs. Use QR or manual setup as fallback.

## 20. Optional Namecheap and DNS Setup

Namecheap DNS is optional during local LAN development.

A domain only works publicly if the backend/web app is reachable through a public IP, VPS, reverse proxy, tunnel, or hosting provider.

A local LAN-only server cannot be made publicly reachable just by adding a DNS record.

If a public deployment is later required, point DNS to the public host or reverse proxy, terminate HTTPS, and set:

```env
PUBLIC_DOMAIN=psau-credentials.cfd
DOMAIN_API_BASE_URL=https://psau-credentials.cfd/api
DOMAIN_WEB_BASE_URL=https://psau-credentials.cfd
VERIFICATION_WEB_BASE_URL=https://psau-credentials.cfd
PREFERRED_DEPLOYMENT_MODE=domain
```

## Troubleshooting

- If `npm` is blocked in PowerShell, run `npm.cmd`.
- If the phone cannot connect, verify both devices are on the same LAN/VLAN and Windows Firewall allows ports 5000 and 5173.
- If QR pairing fails, use manual server setup in the mobile Settings tab.
- If auto-discovery fails, assume multicast is blocked and use QR/manual setup.
- If backend startup fails, check `server\.env`, MongoDB service status, and port conflicts.
- If seeding says students already exist, use `--force true` to add/overwrite demo slots or `--reset true` to remove only matching demo seed records first.
