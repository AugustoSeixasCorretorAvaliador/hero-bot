# NETWORK — WebSocketManager and connectivity

Objetivo: mover comunicação para WebSocket com ack/heartbeat e manter HTTP apenas para status/debug/version.

Componentes
- `WebSocketManager` — conecta a um WebSocket client (na rede local) ou atua como servidor embutido.
- `ProtocolParser` — valida envelope JSON, enfileira mensagens para `StateMachine`.
- `MessageQueue` — garante entrega com retries e timeouts.

Features
- Heartbeat: cliente envia `PING`, device responde `PONG` ou `HERO_PONG`.
- Reconnect automático com backoff.
- Message ACKs: mensagens marcadas com `requiresAck` são re-enviadas se não houver `ACK` em timeout.

Implementation notes
- Para ESP32-S3, considerar `AsyncWebServer` + `AsyncWebSocket` ou `WebSocketsServer` (dependendo de APIs de TLS futuras).
