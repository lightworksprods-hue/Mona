# Mona POS Windows Hardware Bridge

This small Windows process connects the online POS to the cash drawer attached to the store's receipt printer. The client does not need the application source code.

## Development test

Install Node.js 18 or newer on the store Windows computer. Copy `.env.example` to `.env`, set the same `HARDWARE_BRIDGE_TOKEN` configured on the server, then run:

```powershell
node bridge.js
```

The bridge polls Render for commands and sends the ESC/POS drawer-open command to `POS80 Printer`.

## Build the Windows executable

From this folder on a development computer with Node.js installed:

```powershell
.\build.ps1
```

The resulting `dist` folder contains `MonaPOS-HardwareBridge.exe`, the printer script, and the configuration template. Copy the folder to the client's POS computer, rename `.env.example` to `.env`, fill in the bridge token, then run the executable.

## Server configuration

Set this on the Render server:

```env
HARDWARE_BRIDGE_TOKEN=<long-random-secret>
```

Run the new Prisma migration before using the bridge:

```powershell
npx prisma migrate deploy
npx prisma generate
```

The production installer should run this bridge automatically at Windows startup. Packaging it into an `.exe` is the next release step after testing the bridge on the store computer.
