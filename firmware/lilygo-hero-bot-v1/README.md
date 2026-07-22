# HERO.Bot LILYGO T-Display-S3 V1

Firmware target for the LILYGO T-Display-S3 V1.3 (ESP32-S3, 16 MB Flash,
8 MB PSRAM and ST7789 display).

## Purpose

- Provide the physical renderer for HERO events.
- Keep hardware-specific display details isolated from application code.
- Preserve the simulator and the existing firmware targets.

## Current status

- Stage A implemented: ST7789 display and Wi-Fi provisioning.
- Stage B implemented: validated HeroEvent WebSocket client, ACK, heartbeat,
  automatic reconnect and a temporary technical event screen.
- The setup portal stores SSID, password, server host, port, optional token and
  device name in NVS. It returns to setup mode after three failed Wi-Fi attempts.
- The complete state machine and native animations remain the next stages.

## Build

```powershell
python -m platformio run -e lilygo-hero-bot-v1
```

## Upload (manual authorization required)

```powershell
python -m platformio run -e lilygo-hero-bot-v1 -t upload --upload-port COMx
```

Replace `COMx` with the port assigned to the board.

## First boot

1. Connect to the open access point `HERO-BOT-SETUP`.
2. Open `http://192.168.4.1` if the captive portal does not open automatically.
3. Enter the Wi-Fi SSID/password, computer host or IPv4, WebSocket port,
   optional token and device name.

Defaults:

- host: `hero-host.local`;
- port: `8765`;
- device name: `hero-bot-001`.

For the first hardware validation, use the computer IPv4 shown by `ipconfig`.
Resolution of `hero-host.local` is reserved for the future mDNS integration.

The setup AP is intentionally minimal for local bring-up. It has no AP password
or encrypted NVS yet and must not be treated as the final production security
model. Stored Wi-Fi passwords and shared tokens are never rendered back into the
portal HTML; leaving either field blank preserves its current value, and the
portal provides an explicit checkbox to remove the token.

## Planned protocol

The bridge will use a simple JSON envelope like:

```json
{
  "type": "HERO_READY",
  "layer": "operational",
  "source": "hero-event-bus",
  "timestamp": 123456,
  "payload": {}
}
```

## Next integration stages

- Stage C: HeroStateMachine using the existing HeroOS event names.
- Stage D: native 320 x 170 renderer equivalent to the simulator intent.
- Stage E: heartbeat, reconnect and OFFLINE behavior.
