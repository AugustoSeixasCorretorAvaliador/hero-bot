# HERO.Bot Simulator

Simulador desktop mínimo para o HERO.Bot — janela que mostra rosto, estado,
animação e log de eventos do HeroOS. Implementado inicialmente com Electron.

Uso rápido:

- Entrar na pasta `simulator`:

```bash
cd hero.bot/firmware/simulator
```

- Instalar dependências:

```bash
npm install
```

- Executar:

```bash
npm start
```

WebSocket bridge:

O simulador abre um servidor WebSocket em `ws://127.0.0.1:8765` que pode ser
usado pelo `HeroOS` (ou por ferramentas externas) para publicar/assinar
eventos no mesmo formato `HeroEvent` (JSON). O renderer e clientes WS trocam
eventos via o processo principal do Electron.

Observação de segurança: o servidor WS está ligado apenas em `127.0.0.1` (localhost). Não exponha essa porta para redes públicas.

Arquitetura e fluxo
-------------------

- **Processo principal (main)**: abre a janela Electron, o servidor WebSocket e expõe APIs IPC (ex.: `simulator:loadAnimations`). Ele atua apenas como transporte e provedor de assets.
- **Renderer (UI)**: consome eventos via IPC (`hero:event`) e publica eventos via `simulator:publishEvent`. Os módulos do renderer são independentes: `FaceRenderer`, `AnimationRenderer`, `StatusRenderer`, `LogPanel`, `EventPanel`, `StatePanel`, `Timeline` e `Inspector`.
- **Bridge WebSocket**: transporte puro. O HeroOS deve manter toda lógica de estado e decisão; o simulator recebe eventos e apenas renderiza.

Estrutura de telas
------------------

- Painel esquerdo: `Face` (renderização da face), `Animation` e `Timeline` de eventos.
- Painel direito: abas `Test`, `Developer`, `Inspector`.
	- `Test`: botões rápidos para publicar `HeroEvent` (BOOT, READY, IDLE, ...).
	- `Developer`: log de eventos em tempo real.
	- `Inspector`: informações em tempo real (estado atual, último evento, fila, animação, FPS, tempo em estado).

Como adicionar novas animações
-----------------------------

1. Coloque o arquivo JSON em `simulator/assets/animations/` com o formato:

```json
{
	"name": "myanim",
	"fps": 4,
	"frames": [":)", ":|", ":("]
}
```

2. Reabra o simulador ou clique em `Developer` → ele recarrega a lista de animações no startup. O renderer expõe uma API para recarregar dinamicamente quando necessário.

Como executar
-------------

```bash
cd hero.bot/firmware/simulator
npm install
npm start
```

Como adicionar novos estados
---------------------------

- O HeroOS deve publicar eventos `HeroEvent` com `type` sendo o nome do estado (ex.: `THINKING`) e `payload` opcional contendo o nome da animação. O Simulator apenas renderiza conforme o evento recebido.


