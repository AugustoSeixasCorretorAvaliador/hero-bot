# PROTOCOL — HERO Message Protocol (spec)

Objetivo: definir mensagens JSON sobre WebSocket entre HERO.IA (clients) e HERO.Bot.

Envelope básico

{
  "type": "<string>",
  "payload": { },
  "timestamp": 0,
  "id": "<uuid>"
}

Tipos principais (exemplos)
- `HERO_READY` — dispositivo pronto
- `HERO_OPEN` — interface aberta
- `MENU_CLICK` — usuário clicou menu
- `THINKING` — está processando (show thinking animation)
- `WRITING` — escrevendo/typing
- `SUCCESS` — operação concluída
- `ERROR` — erro genérico
- `LEAD_HOT` — lead qualificado
- `BUSY` — ocupado
- `SLEEP` — in low-power

Regras
- Todos os pacotes devem conter `id` e `timestamp`.
- Mensagens que requerem confirmação usam campo `requiresAck:true` no `payload`. O receptor responde com `ACK` tipo contendo `ackFor: id`.

Exemplos

1) HERO ready

{
  "type":"HERO_READY",
  "payload":{"device_id":"<device-id>","version":"0.1"},
  "timestamp":1680000000000,
  "id":"uuid-v4"
}

2) Trigger animation with priority and duration

{
  "type":"PLAY_ANIMATION",
  "payload": {"animationId":"focus", "duration":1500, "priority":10, "requiresAck":true},
  "timestamp":1680000001000,
  "id":"uuid-2"
}

State dispatching
- Messages are parsed by `ProtocolParser` which maps `type` to `StateMachine` events. Events drive `AnimationEngine`.
