# ANIMATIONS — Tabbie (formats, creation, integration)

Detalha como as animações são representadas e integradas ao firmware.

## Formato de armazenamento

- Cada animação é armazenada como um header C com arrays `PROGMEM` contendo bytes que representam bitmaps monocromáticos (Adafruit_GFX format, MSB-first). Exemplo: `hero.bot/firmware/src/idle01.h` — veja comentário de topo e macros `IDLE01_FRAME_COUNT`, `IDLE01_FRAME_DELAY` — [hero.bot/firmware/src/idle01.h](hero.bot/firmware/src/idle01.h#L1-L12).

## Renderização

- As rotinas `drawIdleAnimation()`, `drawFocusAnimation()`, etc., leem frames (ponteiro para PROGMEM) e chamam `display.drawBitmap(0,0, 128/8, 64, frameData)` para pintar cada frame — exemplos em `hero.bot/firmware/src/main.cpp` nas funções de desenho — [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L980-L1040) and [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L1060-L1100).

## Como adicionar nova animação

1. Gerar frames monocromáticos 128×64 e convertê-los para arrays de bytes MSB-first compatíveis com Adafruit_GFX/U8g2 (existem ferramentas que exportam para arrays C).
2. Criar um novo arquivo `myanim.h` em `hero.bot/firmware/src/` com definições:
   - `#define MYANIM_FRAME_COUNT N`
   - `#define MYANIM_FRAME_DELAY X` (ms)
   - `const unsigned char PROGMEM myanim_frame_001[] = { ... }`
3. Incluir `#include "myanim.h"` em `main.cpp` e implementar `drawMyAnim()` (ou reutilizar o padrão de `draw*Animation()`), chamando `display.drawBitmap(...)` com os frames.

## Como o firmware decide qual animação executar

- A variável global `currentAnimation` controla qual rotina é desenhada. `handleAnimation()` atualiza `currentAnimation` quando recebe um POST `/api/animation` — [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L760-L820) e `updateDisplay()` seleciona a rotina a executar — [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L840-L900).

## Sugestões para evolução das animações

- Armazenar frames em LittleFS/SD para permitir adicionar/atualizar sem recompilar.
- Implementar compressão (RLE/LZ) para reduzir footprint.
- Fornecer utilitário de conversão (PNG → PROGMEM arrays) e documentação de pipeline.
