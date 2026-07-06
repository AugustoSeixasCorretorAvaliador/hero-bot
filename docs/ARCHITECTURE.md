# ARCHITECTURE — HERO.Bot (RFC)

Visão geral arquitetural para o HERO.Bot, focada em modularidade, testabilidade e escalabilidade.

Principais camadas

- Firmware (PlatformIO): `firmware/`
  - `core/` — ciclo de vida, `main.cpp` de alto nível
  - `hal/` — abstração de hardware (display, network, storage, audio, power)
  - `animation/` — `AnimationEngine`, `AnimationRepository`, `AnimationLoader`
  - `network/` — `WebSocketManager`, `Protocol`, `StateMachine`
  - `ota/` — `OTAService`, `FirmwareUpdater`, `VersionManager`
  - `drivers/` — implementações concretas (TFT driver para T-Display S3)

Design principles

- Single Responsibility: cada subsistema com interface clara.
- Dependency Inversion: código de alto nível depende de interfaces do HAL.
- State-driven behavior: máquina de estados centralizada controla animações e ações.
- Data-driven animations: animações carregadas de LittleFS com metadados JSON.

Key interfaces (proposals)

- `DisplayManager` (in `hal/display/DisplayManager.h`)
  - `bool init()`
  - `void drawFace(const FaceDescriptor&)`
  - `void drawAnimation(const AnimationFrame&)`
  - `void drawStatus(const StatusInfo&)`
  - `void setBrightness(uint8_t)`
  - `void sleep()` / `void wake()`

- `WebSocketManager` (in `network/`)
  - `bool start()`
  - `void send(const HeroMessage&)`
  - `onMessage(callback)`
  - heartbeat, reconnect, ack handling

- `AnimationEngine`
  - `loadAnimation(id)`
  - `play(id, options)`
  - `stop()`
  - `setPriority()`

Integration points

- `hero.bot/app/` (dashboard) migrará de HTTP to WebSocket for real-time control; legacy HTTP kept for diagnostics.
- `chrome-extension/` will act as a producer of events to HERO.Bot through a WebSocket gateway.

References (current codebase)
- Current HTTP endpoints and animation handling: [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L520-L820)
- Dashboard context: [hero.bot/app/src/contexts/TabbieContext.tsx](hero.bot/app/src/contexts/TabbieContext.tsx#L1-L200)

**Event-driven core**

O núcleo do HERO.Bot será conduzido por um `HeroEventBus` que atua como barramento de eventos interno. Todos os subsistemas publicam/assinam eventos em vez de comunicar diretamente. Fluxo exemplo:

Chrome Extension
   │
   ▼
 WebSocketManager
   │
   ▼
   HeroEventBus
   │
 ┌──────┼─────────┐
 ▼      ▼         ▼
State  Animation Display
Machine Engine    Manager

Cada módulo tem responsabilidades claras:
- `WebSocketManager`: converte mensagens de rede (WebSocket) em `HeroEvent` e publica no `HeroEventBus`.
- `HeroEventBus`: distribui eventos para assinantes de forma síncrona. Fornece API simples `subscribe`/`publish`.
- `StateMachine`: reage a eventos, gerencia transições, publica eventos de estado/resultados.
- `AnimationEngine`: assina eventos de estado e publica `PLAY_ANIMATION` quando necessário.
- `DisplayManager`: assina `PLAY_ANIMATION` e executa renderizações (ou, em scaffold, escreve no `Serial`).

References (current codebase)
- Current HTTP endpoints and animation handling: [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L520-L820)
- Dashboard context: [hero.bot/app/src/contexts/TabbieContext.tsx](hero.bot/app/src/contexts/TabbieContext.tsx#L1-L200)
# ARCHITECTURE — Tabbie

Este documento detalha a arquitetura do sistema Tabbie, com referências diretas ao código-fonte.

## Componentes

- **Dashboard (PC)**: aplicação React em `hero.bot/app/`. Entry: `hero.bot/app/src/App.tsx` — monta providers e páginas. See [hero.bot/app/src/App.tsx](hero.bot/app/src/App.tsx#L1-L40).
- **Communication**: HTTP REST over Wi‑Fi; dashboard discovers device via `tabbie.local` (mDNS) e faz `fetch` para `/api/*`. See [hero.bot/app/src/contexts/TabbieContext.tsx](hero.bot/app/src/contexts/TabbieContext.tsx#L1-L40) and [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L16-L22).
- **Firmware (ESP32)**: runs WebServer on port 80, handles captive portal/AP for setup, draws animations on OLED via U8g2, moves servo. Main: `hero.bot/firmware/src/main.cpp` — [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L1-L40).
- **Assets**: animations embedded as PROGMEM headers in `hero.bot/firmware/src/*.h` — example `idle01.h` — [hero.bot/firmware/src/idle01.h](hero.bot/firmware/src/idle01.h#L1-L12).

## Data Flow

1. User action in Dashboard triggers `sendAnimation()` → HTTP POST to ESP32 `/api/animation`.
2. ESP32 updates internal state (`currentAnimation`) and `animationStartTime`.
3. `loop()` continually calls `updateDisplay()` which calls the appropriate `draw*Animation()` that reads frames from PROGMEM and calls `display.drawBitmap(...)`.
4. Selected frames may trigger `moveServoTo()` which is applied smoothly by `updateServoMovement()`.

## Discovery & Connectivity

- Dashboard tries addresses: custom IP, `tabbie.local`, last working IP. Discovery logic in `TabbieContext.checkConnection()` — [hero.bot/app/src/contexts/TabbieContext.tsx](hero.bot/app/src/contexts/TabbieContext.tsx#L40-L120).
- Firmware advertises via mDNS: `MDNS.begin(MDNS_NAME)` (`MDNS_NAME = "tabbie"`) — [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L320-L340).

## Deployment Notes

- Firmware built with PlatformIO (`platformio.ini`) targeting `esp32dev` — [hero.bot/firmware/platformio.ini](hero.bot/firmware/platformio.ini#L1-L6).
- Dashboard runs with Vite: `npm run dev` in `hero.bot/app/` — `hero.bot/app/package.json` scripts — [hero.bot/app/package.json](hero.bot/app/package.json#L1-L20).
