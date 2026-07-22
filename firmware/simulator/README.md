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

O simulador abre um servidor WebSocket em `ws://0.0.0.0:8765`. Clientes locais
continuam usando `ws://127.0.0.1:8765`; o HERO.Bot físico usa o IPv4 do
computador na rede local. A porta pode ser alterada com `HERO_WS_PORT`.

O servidor valida, normaliza e distribui cada HeroEvent ao renderer Electron e
aos demais clientes WebSocket, sem devolver o evento original ao remetente. O
remetente recebe apenas `ACK` ou `NACK`.

Envelope canônico:

```json
{
  "id": "uuid-ou-id-gerado",
  "type": "THINKING",
  "source": "chrome-extension",
  "target": "broadcast",
  "timestamp": 1780000000000,
  "payload": {}
}
```

Eventos aceitos: `BOOT`, `HERO_READY`, `HERO_OPEN`, `IDLE`, `THINKING`,
`WRITING`, `SUCCESS`, `ERROR`, `LEAD_HOT`, `SLEEP` e `OFFLINE`.

Aliases retrocompatíveis na entrada:

- `READY` vira `HERO_READY`;
- `HOT_LEAD` vira `LEAD_HOT`.

As mensagens legadas podem omitir `id`, `target`, `timestamp` e `payload`; o
servidor completa esses campos. Mensagens binárias, JSON inválido, tipos
desconhecidos e mensagens acima de 4096 bytes são rejeitados.

## Segurança da rede local

O bind `0.0.0.0` expõe a porta em todas as interfaces do computador. Não faça
redirecionamento da porta 8765 no roteador e não permita a regra em redes
públicas. No Firewall do Windows, permita TCP 8765 apenas no perfil **Privado**
e, de preferência, somente para `LocalSubnet`.

Exemplo manual em PowerShell elevado (não executado pelo projeto):

```powershell
New-NetFirewallRule -DisplayName "HERO.Bot WS 8765" -Direction Inbound -Protocol TCP -LocalPort 8765 -Action Allow -Profile Private -RemoteAddress LocalSubnet
```

O token compartilhado é opcional e fica desabilitado quando a variável está
vazia. Para habilitá-lo somente na sessão atual:

```powershell
$env:HERO_WS_TOKEN="seu-token-local"
npm start
```

O token nunca é impresso nos logs. A extensão atual permanece compatível quando
o token está desabilitado; suporte de token na extensão fica para uma etapa
futura.

Arquitetura e fluxo
-------------------

- **Processo principal (main)**: abre a janela Electron, o servidor WebSocket e expõe APIs IPC (ex.: `simulator:loadAnimations`). Ele atua apenas como transporte e provedor de assets.
- **Renderer (UI)**: consome eventos via IPC (`hero:event`) e publica eventos via `simulator:publishEvent`. Os módulos do renderer são independentes: `FaceRenderer`, `AnimationRenderer`, `StatusRenderer`, `LogPanel`, `EventPanel`, `StatePanel`, `Timeline` e `Inspector`.
- **Bridge WebSocket**: barramento local que valida, normaliza, confirma e
  distribui eventos. O HeroOS mantém a lógica de estado; cada destino renderiza
  nativamente a mesma intenção visual.

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

## Testes

```powershell
npm test
```

Com o simulador em execução, envie um evento real e valide o ACK:

```powershell
npm run smoke:ws -- ws://127.0.0.1:8765
```

Para testar pelo mesmo endereço usado pelo ESP32, descubra o IPv4 do computador
com `ipconfig` e execute:

```powershell
npm run smoke:ws -- ws://192.168.1.10:8765
```


