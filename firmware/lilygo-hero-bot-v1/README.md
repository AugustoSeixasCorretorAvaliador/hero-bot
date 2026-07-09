# HERO.Bot LILYGO T-Display-S3 Skeleton

This folder is a placeholder for the future HERO.Bot firmware that will run on the LILYGO T-Display-S3.

## Purpose

- Receive the Device Bridge protocol over Wi-Fi/WebSocket.
- Later expand to BLE without changing the event protocol used by the extension.
- Keep the current local simulator and extension flow untouched until the board is available.

## Current status

- No device-specific logic is implemented yet.
- The project is not meant to be flashed or validated against real hardware today.
- The only goal is to reserve the structure for the future integration work.

## Planned protocol

The bridge will use a simple JSON envelope like:

```json
{
  "type": "READY",
  "layer": "operational",
  "source": "hero-event-bus",
  "timestamp": 123456,
  "payload": {}
}
```

## Next step when the board arrives

- Add the real Wi-Fi/WebSocket receiver.
- Map the envelope to device actions.
- Add BLE support if it is still needed after the WebSocket path is validated.