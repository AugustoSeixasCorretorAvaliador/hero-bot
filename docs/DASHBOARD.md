# DASHBOARD — Tabbie (React)

Visão técnica do painel React que controla o Tabbie.

## Estrutura

- Projeto em `hero.bot/app/` (Vite + React). Dependências e scripts: `hero.bot/app/package.json` — [hero.bot/app/package.json](hero.bot/app/package.json#L1-L40).
- Entradas principais:
  - `hero.bot/app/src/main.tsx` — bootstrap da app.
  - `hero.bot/app/src/App.tsx` — composição das páginas e providers (`TodoProvider`, `DarkModeProvider`, `TabbieProvider`) — [hero.bot/app/src/App.tsx](hero.bot/app/src/App.tsx#L1-L40).

## Comunicação com o Tabbie

- `TabbieContext` (`hero.bot/app/src/contexts/TabbieContext.tsx`) implementa:
  - Reconhecimento do dispositivo (tenta `tabbie.local`, IP custom, last known IP) — [hero.bot/app/src/contexts/TabbieContext.tsx](hero.bot/app/src/contexts/TabbieContext.tsx#L40-L120).
  - `sendAnimation(animation, task, duration)` — faz `fetch('http://' + customIP + '/api/animation', {method:'POST', body: JSON.stringify(...)})` — [hero.bot/app/src/contexts/TabbieContext.tsx](hero.bot/app/src/contexts/TabbieContext.tsx#L120-L200).
  - `triggerDebug()` e `checkConnection()` helpers.

## Integração Pomodoro / Tasks

- `TabbieContext` observa estado do `pomodoroTimer` (provido pelo `TodoContext`) e sincroniza animações automaticamente (enviando `focus`, `break`, `complete`, `paused`, `idle`) — sincronização: [hero.bot/app/src/contexts/TabbieContext.tsx](hero.bot/app/src/contexts/TabbieContext.tsx#L260-L420).

## Run (dev)

No terminal, dentro de `hero.bot/app/`:

```bash
npm install
npm run dev
```
