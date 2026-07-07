# HERO.BOT — Engineering Reverse-Engineering Report

Este documento contém a engenharia reversa completa do projeto **HERO.BOT** (código em `hero.bot`). Todas as conclusões são justificadas por referências a arquivos, funções e trechos do código-fonte.

## Sumário
- Visão geral e objetivo
- Arquitetura e diagrama de componentes
- Fluxo Dashboard → ESP32 → Display
- Protocolo HTTP (endpoints, payloads JSON)
- Estrutura do firmware
- Estrutura do dashboard (React)
- Animações e organização dos assets
- Hardware identificado (GPIOs, display, periféricos)
- Diagrama de estados
- Dependências / bibliotecas
- Pontos fortes, limitações e sugestões de evolução

---

## 1. Visão Geral

- Objetivo: HERO.BOT é um robô de mesa com rosto em OLED que exibe animações, executa pequenas interações (servo para pescoço) e recebe comandos de um dashboard local. (veja [hero.bot/README.md](hero.bot/README.md#L1-L20) e [hero.bot/docs/get_started.md](hero.bot/docs/get_started.md#L1-L30)).
- Componentes principais: Dashboard React (`hero.bot/app/`), Firmware ESP32 (`hero.bot/firmware/`), Assets de animação (`hero.bot/firmware/src/*.h`), hardware (STL) (`hero.bot/hardware/STL/`).

## 2. Arquitetura e Diagrama de Componentes

- Arquitetura resumida:

```
PC
↓
Dashboard (React, Vite)
↓
HTTP (REST over Wi‑Fi, mDNS discovery)
↓
ESP32 (WebServer, U8g2 display driver, Servo control)
↓
Display (128×64 OLED) + Servo
```

- Referências:
  - `hero.bot/app/src/contexts/HERO.BOTContext.tsx` — descoberta/cliente HTTP e `sendAnimation()` (mDNS fallback para `HERO.BOT.local`). See [hero.bot/app/src/contexts/HERO.BOTContext.tsx](hero.bot/app/src/contexts/HERO.BOTContext.tsx#L1-L40).
  - `hero.bot/firmware/src/main.cpp` — WebServer endpoints `/api/*` e lógica de Wi‑Fi/AP/captive portal. See [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L520-L560).

## 3. Fluxo (Dashboard → ESP32 → Display)

1. Dashboard chama `HERO.BOTContext.sendAnimation()` que faz `fetch('http://<ip>/api/animation', POST, JSON)` — [hero.bot/app/src/contexts/HERO.BOTContext.tsx](hero.bot/app/src/contexts/HERO.BOTContext.tsx#L120-L200).
2. ESP32 recebe POST `/api/animation` em `handleAnimation()` (ArduinoJson parsed) e atualiza `currentAnimation`, `currentTask`, `animationStartTime` — [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L760-L820).
3. `loop()` chama `updateDisplay()` que seleciona a rotina `draw*Animation()` correspondente e desenha frames com U8g2 `drawBitmap` — [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L840-L900) e animation headers em `hero.bot/firmware/src/` (ex.: `idle01.h`).
4. Sequência de keyframes no `draw*` podem comandar `moveServoTo()`; `updateServoMovement()` executa movimento suave — [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L28-L36) and [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L60-L80).

## 4. Protocolo HTTP — Endpoints e Formato JSON

- Server: ESP32 runs HTTP server on port `80` (`WebServer server(80);`) — [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L16-L22).
- Principais endpoints definidos em `setupWebServer()`:
  - `GET /api/status` → retorna JSON (status, animation, task, uptime, setupMode, ip) — handled by `handleStatus()` [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L560-L620).
  - `POST /api/animation` → aceita JSON payload, keys: `animation` (string), `task` (string), `duration` (number, optional) — handled by `handleAnimation()` [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L760-L820).
  - `POST /api/debug` → triggers debug overlay on OLED — `handleDebug()` [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L640-L700).
  - `POST /api/reset` → clears saved Wi‑Fi and restarts to setup mode — `handleReset()` [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L600-L640).
  - `/wifi` and captive portal routes (`/`, `/setup`, `/configure`) — see [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L440-L540).

- JSON formats (examples):

Request POST /api/animation

```json
{ "animation": "focus", "task": "Write report", "duration": 1500 }
```

Response (success):

```json
{ "success": true, "animation": "focus", "task": "Write report" }
```

Request GET /api/status response example (partial):

```json
{
  "status": "connected",
  "animation": "idle",
  "task": "",
  "uptime": 123456,
  "setupMode": false,
  "ip": "192.168.1.50",
  "ssid": "MyWifi",
  "rssi": -60
}
```

Referências: `handleAnimation()`, `handleStatus()` in [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L760-L820) and [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L560-L620).

## 5. Estrutura do Firmware

- PlatformIO config: `hero.bot/firmware/platformio.ini` — target `board = esp32dev`, framework `arduino`, `lib_deps` includes `U8g2`, `ArduinoJson`, `ESP32Servo` — [hero.bot/firmware/platformio.ini](hero.bot/firmware/platformio.ini#L1-L12).
- Código principal: `hero.bot/firmware/src/main.cpp` — contém `setup()`, `loop()`, Wi‑Fi state machine, web server setup e funções de desenho de animação.
- Assets de animação: headers `hero.bot/firmware/src/idle01.h`, `focus01.h`, `relax01.h`, `love01.h`, `startup01.h`, `angry_bitmap.h` — frames PROGMEM, macros `*_FRAME_COUNT`, `*_FRAME_DELAY` e arrays de frames.

Arquivos-chave:
- `hero.bot/firmware/src/main.cpp` — (setup, WiFi, web server, draw functions) [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L1-L40).
- `hero.bot/firmware/src/idle01.h` — exemplo de asset: bitmap frames em PROGMEM (Adafruit_GFX format) [hero.bot/firmware/src/idle01.h](hero.bot/firmware/src/idle01.h#L1-L12).

Fluxo de inicialização (ver `main.cpp`):
1. `setup()` inicializa Serial, display (`display.begin()`), servo, Preferences e carrega credenciais (`loadWiFiCredentials()`) — [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L30-L80).
2. Se sem credenciais → `startSetupMode()` (AP + DNS captive portal) — [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L200-L260).
3. Se credenciais → `handleWiFiConnection()` tenta conectar; em sucesso chama `startNormalMode()` e `setupWebServer()` — [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L200-L340).

## 6. Estrutura React (Dashboard)

- Stack: Vite + React (ver `hero.bot/app/package.json`, scripts `dev` uses `vite`) — [hero.bot/app/package.json](hero.bot/app/package.json#L1-L20).
- Entrada: `hero.bot/app/src/main.tsx` e `hero.bot/app/src/App.tsx` — `App.tsx` monta providers (`TodoProvider`, `DarkModeProvider`, `HERO.BOTProvider`) e páginas (Dashboard, Pomodoro, Settings) — [hero.bot/app/src/App.tsx](hero.bot/app/src/App.tsx#L1-L40).
- Comunicação: `hero.bot/app/src/contexts/HERO.BOTContext.tsx` provides `sendAnimation()`, `checkConnection()`, `triggerDebug()` and auto-sync behavior with pomodoro state; it calls `fetch('http://<ip>/api/status')` and `fetch('http://<ip>/api/animation')` — [hero.bot/app/src/contexts/HERO.BOTContext.tsx](hero.bot/app/src/contexts/HERO.BOTContext.tsx#L1-L120).
- Estado global: React Contexts (`HERO.BOTContext`, `TodoContext`, `DarkModeContext`) — see `hero.bot/app/src/contexts/`.

## 7. Animações — Organização e Formato

- Formato: Bitmaps monocromáticos em PROGMEM, Adafruit_GFX/MSB-first; cada animation header declara `*_FRAME_COUNT`, `*_FPS` e `*_FRAME_DELAY`. Ex.: `hero.bot/firmware/src/idle01.h` (cabecalho) — [hero.bot/firmware/src/idle01.h](hero.bot/firmware/src/idle01.h#L1-L12).
- Onde ficam: `hero.bot/firmware/src/*.h` (cada arquivo contém arrays `PROGMEM` com frames de 128×64). Exemplos: `idle01.h`, `focus01.h`, `relax01.h`, `love01.h`, `startup01.h`, `angry_bitmap.h`.
- Renderização: `display.drawBitmap(0, 0, 128/8, 64, frameData)` — chamadas em `drawIdleAnimation()`, `drawFocusAnimation()` etc. — [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L980-L1010).
- Sincronização com servo: keyframes hard-coded (por número de frames) nos `draw*` functions que chamam `moveServoTo(...)`; `updateServoMovement()` move servo suavemente. Ex.: `drawIdleAnimation()` keyframes em [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L1008-L1036) e `updateServoMovement()` em [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L54-L68).

## 8. Estrutura dos Assets

- Assets embutidos: headers com frames (`.h`) sob `hero.bot/firmware/src/`.
- Hardware: 3D parts (STL) em `hero.bot/hardware/STL/`.

## 9. Hardware identificado

- Display: 128×64 OLED SH1106/compatible. Evidence: `U8G2_SH1106_128X64_NONAME_F_HW_I2C` in `main.cpp` and `idle01.h` header comments. See [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L16-L22) and [hero.bot/firmware/src/idle01.h](hero.bot/firmware/src/idle01.h#L1-L8).
- ESP32: PlatformIO `board = esp32dev` configured in `platformio.ini` — [hero.bot/firmware/platformio.ini](hero.bot/firmware/platformio.ini#L1-L6).
- GPIO mapping (extracted from `main.cpp`):
  - Servo: GPIO13 (`SERVO_PIN = 13`) — [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L6-L14).
  - I2C: SDA=GPIO21, SCL=GPIO22 (Wire.begin(21,22)) — [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L36-L44) and docs [hero.bot/firmware/README.md](hero.bot/firmware/README.md#L8-L12).
  - Debug button: GPIO27 (`DEBUG_BUTTON_PIN = 27`) — [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L60-L68).

## 10. Diagrama de Estados (simplificado)

- States: `startup` → `idle` (normal) ↔ `focus` / `break` / `paused` / `love` / `complete`.
- Transições:
  - `startup` ends → sets `currentAnimation = "idle"` (see `drawStartupAnimation()`) — [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L1140-L1150).
  - Dashboard POST `focus` → `handleAnimation()` sets `currentAnimation = "focus"` and manages timers — [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L760-L820).

## 11. Dependências / Bibliotecas

- Firmware (PlatformIO `lib_deps`):
  - `olikraus/U8g2` — display driver — [hero.bot/firmware/platformio.ini](hero.bot/firmware/platformio.ini#L8-L10).
  - `bblanchon/ArduinoJson` — JSON parsing — [hero.bot/firmware/platformio.ini](hero.bot/firmware/platformio.ini#L8-L10) and usage in `main.cpp` [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L760-L820).
  - `madhephaestus/ESP32Servo` — servo control — [hero.bot/firmware/platformio.ini](hero.bot/firmware/platformio.ini#L8-L10) and `setupServo()` [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L28-L36).
- Dashboard (NPM deps): React, Vite, tailwind, @dnd-kit, radix-ui — see `hero.bot/app/package.json` — [hero.bot/app/package.json](hero.bot/app/package.json#L1-L80).

## 12. Pontos Fortes

- Projeto funcional e completo: contém dashboard + firmware + assets e instruções de montagem (`docs/get_started.md`) — [hero.bot/docs/get_started.md](hero.bot/docs/get_started.md#L1-L20).
- Animações embutidas permitem funcionamento offline sem necessidade de transferências em runtime.
- Captive portal e modo AP facilitam configuração de Wi‑Fi para usuários não técnicos (`startSetupMode()` in `main.cpp`).

## 13. Limitações

- Assets embutidos aumentam tamanho do firmware e dificultam atualizações de animações (não há OTA). Não foi encontrado código de OTA no repositório (não encontrado).
- API sem autenticação nem TLS (HTTP plain) — risco para produto comercial.
- Hardware/bom incompleto: SKU de ESP32 exato, memória Flash/PSRAM, e esquema de alimentação/bateria não especificados (não encontrados em repositório).

## 14. Sugestões de Evolução

1. Mover assets para LittleFS/SPIFFS e implementar OTA para atualizações de firmware e animações.
2. Adicionar autenticação simples (token) para comandos HTTP e, se possível, suporte a WebSocket para menor latência.
3. Implementar armazenamento compressão/streaming de animações (gzip/LZ4) para economizar flash.
4. Definir BOM e documentação de hardware (modelo do ESP32, bateria, circuito de carga) para produção.

---

Para documentação detalhada separada, veja os arquivos gerados: `ARCHITECTURE.md`, `API.md`, `FIRMWARE.md`, `DASHBOARD.md`, `ANIMATIONS.md` no mesmo diretório.
