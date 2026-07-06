# STATE_MACHINE — modeling behavior for HERO.Bot

Estado central: `HeroStateMachine` — orquestra animações e hardware.

Estados (propostos)
- `Idle`
- `Thinking`
- `Writing`
- `Listening`
- `Busy`
- `Sleeping`
- `Error`
- `Celebrating`
- `HotLead`

Estado padrão

- Cada estado implementa:
  - `onEnter(Event)`
  - `onUpdate(deltaMs)`
  - `onExit()`

Transições
- Baseadas em mensagens do `Protocol` (`HERO_OPEN`, `THINKING`, `WRITING`, `SUCCESS`, `ERROR`, `LEAD_HOT`), eventos de hardware (botão) e timers.

Exemplo: `Idle` -> `Thinking`
- Trigger: `PLAY_ANIMATION` tipo `thinking` ou `THINKING` message
- onEnter: `AnimationEngine.play('thinking')`, `DisplayManager.setBrightness(80)`
- onUpdate: monitorar heartbeat, sensor input
- onExit: `AnimationEngine.stop()`

Prioridade
- Estados críticos (Error, HotLead) têm prioridade preemptiva. `AnimationEngine` deve aceitar prioridade e preempt lower-priority animations.
