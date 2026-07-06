# MIGRATION_TO_HEROBOT — Transformação para HERO.Bot

Versão: 0.1
Autor: Arquitetura de Plataforma HERO.IA

Resumo executivo
- Objetivo: evoluir o projeto Tabbie para um produto robusto chamado HERO.Bot, baseado em ESP32-S3 com display TFT, armazenamento LittleFS, comunicação em WebSocket e arquitetura modular (HAL, AnimationEngine, WebSocketManager, OTA, Storage, Power, Audio).
- Resultado esperado: firmware e software refatorados, API de tempo-real via WebSocket com protocolo `HERO`, integração com extensões e event bus do ecossistema HERO.IA.

Arquitetura atual (base)
- Firmware: `hero.bot/firmware/src/main.cpp` roda um WebServer HTTP, endpoints `/api/status`, `/api/animation`, usa `U8g2` e `ArduinoJson`. Referência do código: [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L1-L120).
- Animações embutidas em `PROGMEM` (ex: [hero.bot/firmware/src/idle01.h](hero.bot/firmware/src/idle01.h#L1-L12)).
- Dashboard: React em `hero.bot/app/` usa `TabbieContext` que faz `fetch` para `/api/animation` — [hero.bot/app/src/contexts/TabbieContext.tsx](hero.bot/app/src/contexts/TabbieContext.tsx#L1-L80).

Arquitetura proposta (alto nível)
- Firmware reorganizado:
  - `firmware/` (PlatformIO)
    - `core/` — entrypoints, lifecycle
    - `hal/` — hardware abstraction: `display/`, `network/`, `storage/`, `audio/`, `power/`, `drivers/`
    - `animation/` — `AnimationEngine`, `AnimationLoader`, `AnimationRepository`
    - `network/` — `WebSocketManager`, `Protocol`, `StateMachine` (protocol parser + dispatcher)
    - `ota/` — `OTAService`, `FirmwareUpdater`, `VersionManager`
    - `hero/` — domain-level integration behaviors

O que será reaproveitado
- Lógica de animações e frames (como base para conversão): [hero.bot/firmware/src/idle01.h](hero.bot/firmware/src/idle01.h#L1-L12).
- Mapas de endpoints e payloads atuais para derivar o novo protocolo.
- Conceitos de servo e movimentos (algoritmos `moveServoTo()` / `updateServoMovement()`).

O que será refatorado
- Substituir chamadas diretas ao display por `DisplayManager`.
- Remover PROGMEM-embeds e migrar animações para LittleFS com metadados JSON.
- Trocar o transporte primário de HTTP para WebSocket com ACKs, heartbeat e fila.
- Implementar state machine centralizada e separar presentation (display) da lógica.

O que será descartado
- Endpoints HTTP para ações de tempo real (serão mantidos apenas `/status`, `/debug`, `/version`).
- Dependências específicas do hardware antigo (pinos e libs específicos do display monocromático).

Dependências (futuras / atuais)
- PlatformIO, LittleFS, AsyncWebServer/AsyncWebSocket ou WebSocket libs compatíveis com ESP32-S3, ArduinoJson, TFT drivers (ex: TFT_eSPI ou LovyanGFX), OTA libraries.

Riscos
- Integração de drivers TFT com ESP32-S3 e compatibilidade com T-Display S3.
- Consumo de memória ao migrar animações para LittleFS e uso simultâneo de heap para run-time.
- Latência/performance do WebSocket em redes reais.

Benefícios
- Modularidade, OTA, menor tempo de iterações, possibilidade de atualizações remotas de animações e features.

Plano de migração (macro)
1. Documentação e RFC (este documento). (0.1)
2. Especificação do protocolo WebSocket `HERO` e máquina de estados. (PROTOCOL.md, STATE_MACHINE.md) (0.2)
3. Scaffolding do firmware com HAL e diretórios. (ARCHITECTURE.md, DISPLAY.md, NETWORK.md)
4. Implementar `WebSocketManager` + parser + `StateMachine`. (network)
5. Implementar `AnimationEngine` com LittleFS e loader. (animation + storage)
6. Implementar `DisplayManager` adaptado a T-Display S3 (driver agnóstico). (display)
7. Criar OTA interfaces e VersionManager (ota).
8. Atualizar dashboard e criar `chrome-extension/` skeleton para enviar eventos via WebSocket gateway.
9. Testes integrados, ajuste UX, otimizações. (QA)

+Cronograma (exemplo, semanas)
- Week 1: Spec + Scaffolding + Protocol design
- Week 2: HAL scaffold + DisplayManager prototype on T-S3
- Week 3: WebSocketManager + StateMachine
- Week 4: AnimationEngine + LittleFS loader
- Week 5: OTA interfaces + Dashboard integration
- Week 6: QA, optimization, documentation

Notas finais
- Após sua aprovação deste plano e dos arquivos listados a seguir (alterados e novos), iniciarei a implementação incremental, seguindo o TODO e atualizando o backlog e roadmap.
