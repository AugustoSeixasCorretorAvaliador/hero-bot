# API — Tabbie (HTTP REST)

Documentação técnica da API HTTP exposta pelo firmware do Tabbie.

Base: `hero.bot/firmware/src/main.cpp` — `setupWebServer()` registra handlers para os endpoints principais. See [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L520-L560).

## Endpoints

1) `GET /api/status`
- Descrição: retorna o estado atual (wifi status, animação atual, tarefa, uptime, ip).
- Response JSON keys: `status`, `animation`, `task`, `uptime`, `setupMode`, `ip`, `ssid`, `rssi` (quando conectado).
- Implementação: `handleStatus()` — [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L560-L620).

2) `POST /api/animation`
- Descrição: instrui o Tabbie a mudar a animação mostrada e opcionalmente passar `task` e `duration`.
- Request body (JSON):

```json
{ "animation": "idle|focus|break|paused|love|pomodoro|complete", "task": "string", "duration": 120 }
```

- Response: JSON with `success` boolean and echoed `animation`/`task`.
- Implementação: `handleAnimation()` — [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L760-L820).

3) `POST /api/debug`
- Descrição: ativa o modo debug (mostra info no OLED por alguns segundos).
- Implementação: `handleDebug()` — [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L640-L700).

4) `POST /api/reset`
- Descrição: limpa credenciais Wi‑Fi salvas e reinicia em modo setup/AP.
- Implementação: `handleReset()` — [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L600-L640).

5) Setup/captive portal endpoints: `/` , `/setup`, `/configure`, `/wifi` — implementam interface web de configuração quando em AP mode — see `handleSetupPage()` and `handleWiFiConfig()` — [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L420-L540).

## Observações sobre segurança e formatos

- O protocolo é plain HTTP e sem autenticação; para produção é recomendado adicionar um token simples ou TLS tunelização.
- O firmware usa `ArduinoJson` para desserializar JSON: veja `deserializeJson` em `handleAnimation()` — [hero.bot/firmware/src/main.cpp](hero.bot/firmware/src/main.cpp#L760-L820).
