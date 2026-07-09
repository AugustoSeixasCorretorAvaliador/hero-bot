# HERO.Bot Chrome Extension

## 1. Pré-requisitos

- `HERO.Bot Simulator` rodando localmente.
- WebSocket disponível em `ws://127.0.0.1:8765`.
- Google Chrome ou Chromium com o modo desenvolvedor ativado.

## 2. Como carregar a extensão

1. Abra `chrome://extensions` no Chrome.
2. Ative o `Developer Mode` no canto superior direito.
3. Clique em `Load unpacked`.
4. Selecione a pasta `chrome-extension/` deste repositório.

## 3. Como testar

1. Abra `https://web.whatsapp.com` no Chrome.
2. Aguarde o carregamento completo do WhatsApp Web.
3. Abra o popup da extensão clicando no ícone da extensão.
4. Confirme que o status mostra `Connected`.
5. Clique nos botões:
   - `IDLE`
   - `WORKING`
   - `DONE`
   - `ERROR`
6. Observe o `HERO.Bot Simulator` reagir aos eventos enviados.

## 4. Teste automático via WhatsApp Web

- Quando o WhatsApp Web estiver carregado, o estado deve iniciar como `READY/IDLE`.
- Ao clicar ou digitar na caixa de mensagem, o estado deve mudar para `THINKING/WORKING`.
- Ao enviar a mensagem, o estado deve mudar para `SUCCESS/DONE`.
- Após aproximadamente 2 segundos, o estado deve voltar para `IDLE`.

## 5. Segurança da V1

- A extensão não lê ou armazena o conteúdo textual das mensagens.
- Nenhum dado é enviado para um backend externo.
- Todo o comportamento roda localmente no navegador.
- A conexão WebSocket usa somente `localhost` (`127.0.0.1`).

## 6. Troubleshooting

- Se o evento não chegar no Simulator, confirme que o `HERO.Bot Simulator` está aberto.
- Verifique se a porta `8765` não está bloqueada ou em uso por outro processo.
- Se o popup indicar desconexão, recarregue a extensão em `chrome://extensions`.
- Confirme que o `WhatsApp Web` já terminou de carregar antes de testar.
- Tente reiniciar o Chrome e recarregar a extensão se necessário.

## 7. Arquitetura de mapeamento Hero.Bot

A extensão agora usa uma camada `HeroInteractionMapper` para separar:

- triggers DOM do `content.js`
- transformação em estados HERO.Bot no `background.js`

### HeroEvents oficiais do HeroOS

- `BOOT`
- `READY`
- `IDLE`
- `THINKING`
- `WRITING`
- `SUCCESS`
- `ERROR`
- `HOT_LEAD`
- `SLEEP`
- `OFFLINE`

### Triggers enviados pelo `content.js`

- `whatsapp_loaded`
- `composition_mouse_enter`
- `composition_focus`
- `typed_key`
- `deleted_text`
- `content_changed`
- `send_button_click`
- `enter_key_send`
- `window_blur`

### Como o mapper converte os triggers

- `whatsapp_loaded` → `READY`
- sem atividade por 5 segundos no estado `READY` → `IDLE`
- `composition_mouse_enter` ou `composition_focus` → `THINKING`
- `typed_key`, `deleted_text` ou `content_changed` → `WRITING`
- `send_button_click` ou `enter_key_send` → `SUCCESS`
- após `SUCCESS` → espera 2000ms e volta para `READY`
- `websocket_disconnected` → `OFFLINE`
- `internal_error` → `ERROR`

### Triggers futuros já preparados no mapper

- `lead_detected` → `HOT_LEAD`
- `system_boot` → `BOOT`
- `sleep_timeout` → `SLEEP`
- `wake_up` → `READY`

### Insight Event Layer

- A extensão possui um `InsightEventMapper` separado para tratar o evento `EVENT_INSIGHT`.
- O mapper não altera `HeroInteractionMapper` nem `ToolEventMapper`.
- O gatilho de insight observa apenas presença/visibilidade do popup lilás no DOM.
- Nenhum conteúdo textual do popup é lido ou armazenado.
- Se o popup permanecer visível após o ciclo de ferramenta concluir (`SUCCESS` e depois `READY`), o fluxo de insight é aplicado:
  - `READY` → espera configurável (padrão `800ms`) → `EVENT_INSIGHT` → `1500ms` → `READY`
- O popup lilás da HERO.IA não é fechado pela extensão.
- O `EVENT_INSIGHT` é enviado para Mini Overlay e Simulator para manter compatibilidade entre camadas visuais.
- Após emitir `EVENT_INSIGHT`, existe uma janela de silêncio (`postInsightSilenceMs`, padrão `4000ms`) para evitar retrigger imediato.

### Tool Event Timing (configurável por ferramenta)

- O `ToolEventMapper` permite configurar tempos por ferramenta.
- Para ferramentas de IA (`TOOL_COPILOT` e `TOOL_RESPONSE_AI`), o `THINKING` mínimo padrão é `3000ms` antes de `WRITING` automático.
- Se houver indício real de escrita/rascunho no DOM, o `WRITING` pode ser antecipado após cumprir mínimo de `1500ms` em `THINKING`.
- Ferramentas rápidas como `TOOL_CREDIT` usam `THINKING` menor.

### Override manual via popup

- O popup envia HeroEvents diretamente para o `background.js` via mensagem `send_event`.
- Esse override não passa pelo DOM e não altera a lógica automática de triggers do WhatsApp Web.

### Benefícios

- evita envio direto de HeroEvents do `content.js`
- isola a lógica de mapeamento para futuras integrações
- mantém os estados do Simulator intactos

## 8. Debug

- Abra o DevTools na página do `WhatsApp Web`.
- Acesse a aba `Console`.
- Filtre por `[HERO.Bot]` e `[HERO.Bot][DOM]`.
- Verifique os logs do content script e do envio de eventos:
  - `content script loaded`
  - `message box found`
  - `working interaction detected`
  - `send detected`
  - `sending state`
  - `chrome.runtime.sendMessage error:`
- Se o message box não for encontrado, recarregue o WhatsApp Web ou aguarde a página terminar de carregar.
- Se o evento não chegar no Simulator, abra também o console do Service Worker da extensão:
  1. Acesse `chrome://extensions`.
  2. Encontre `HERO.Bot Extension`.
  3. Clique em `Service worker` em `Inspect views`.
  4. Verifique os logs `WebSocket connected` e `Sending event`.

### Mini timeline de transicao no overlay (opcional)

- A mini timeline visual do overlay (exemplo: `TOOL_COPILOT -> THINKING -> WRITING -> SUCCESS -> READY`) e exibida apenas em modo debug.
- Voce pode ativar de duas formas:
  1. Pelo popup da extensao: marque `Debug: mini timeline no overlay`.
  2. Pela URL da pagina: abra o WhatsApp Web com `?debug=true`.
- Para desativar:
  1. Desmarque `Debug: mini timeline no overlay` no popup.
  2. Remova `debug=true` da URL.
- A timeline e discreta e nao altera o fluxo funcional do mapeamento de estados.

## 8. Próximos passos

- Melhorar a detecção do DOM do WhatsApp Web.
- Adicionar mais estados de evento para HERO.Bot.
- Integrar a extensão com menus e controles do HERO.Bot.
- Futuro suporte ao display físico `Display32`.
