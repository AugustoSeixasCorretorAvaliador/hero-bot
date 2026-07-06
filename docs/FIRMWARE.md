# FIRMWARE — Tabbie (ESP32)

Detalhes técnicos do firmware que roda no ESP32.

## Projeto PlatformIO

- Arquivo de configuração: `hero.bot/firmware/platformio.ini` — board `esp32dev`, framework `arduino`, `lib_deps` contém `U8g2`, `ArduinoJson`, `ESP32Servo`. See [hero.bot/firmware/platformio.ini](hero.bot/firmware/platformio.ini#L1-L12).

## Arquivos principais

- `hero.bot/firmware/src/main.cpp` — ponto central; contém:
  - `setup()` — inicialização de Serial, display (`setupDisplay()`), servo (`setupServo()`), Preferences e chamada para `loadWiFiCredentials()` — [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L30-L80).
  - `loop()` — chamada a `checkDebugButton()`, `dnsServer.processNextRequest()` (quando em setup), `handleWiFiConnection()`, `server.handleClient()`, `updateDisplay()`, `updateServoMovement()` — [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L360-L420).
  - `setupWebServer()` — registra endpoints e inicia `server.begin()` — [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L520-L560).

## Sub-sistemas importantes

- Wi‑Fi state machine: `loadWiFiCredentials()`, `handleWiFiConnection()`, `startSetupMode()`, `startNormalMode()`. Retry/backoff logic e flags (`wifiInitialized`, `wifiConnecting`, `wifiStatus`) — [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L120-L220) and [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L200-L320).
- Web server endpoints: `handleStatus()`, `handleAnimation()`, `handleDebug()`, `handleReset()`, `handleWiFiConfig()` — see sections in `main.cpp` — [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L560-L820).
- Display rendering: `updateDisplay()` chooses which `draw*Animation()` to run; each `draw*` reads frames from PROGMEM arrays and calls `display.drawBitmap(...)` — [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L840-L900) and `hero.bot/firmware/src/idle01.h` for frame format.
- Servo: `setupServo()`, `moveServoTo()`, `updateServoMovement()` provide smooth servo motions. See [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L28-L36) and [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L54-L68).

## Storage

- `Preferences` is used for saving `wifi_ssid` and `wifi_password` (non-volatile) — `preferences.putString()` in `handleWiFiConfig()` — [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L520-L560).

## Missing / Not Implemented

- No OTA update mechanism detected (nenhum `ArduinoOTA` ou similar). (não encontrado).
- No secure authentication layer for API (HTTP only).
