let lastMessageText = '';
let lastInteractionTime = 0;
let lastInteractionWasTyping = false;
let sendCheckTimer = null;
let extensionRuntimeAvailable = true;
let overlayEnabled = true;
let heroOverlay = null;
let heroOverlayStateEl = null;
let heroOverlayDotEl = null;
let heroOverlayIconEl = null;
let heroOverlayCloseEl = null;
let heroOverlayMinimizeEl = null;
let heroOverlayBodyEl = null;
let heroOverlaySubEl = null;
let heroOverlayFlowEl = null;
let overlayDrag = null;
let activeToolFlow = [];
const TOOL_FLOW_MAX_STEPS = 5;
let overlayDebugTimelineEnabled = false;
let lastInsightPopupVisible = null;
const overlayDebugTimelineByUrl = (() => {
  try {
    return new URLSearchParams(window.location.search).get('debug') === 'true';
  } catch {
    return false;
  }
})();

const OVERLAY_STORAGE_KEY = 'heroOverlayPosition';
const OVERLAY_STATES = new Set([
  'BOOT',
  'READY',
  'IDLE',
  'THINKING',
  'WRITING',
  'SUCCESS',
  'ERROR',
  'HOT_LEAD',
  'SLEEP',
  'OFFLINE'
]);

const TOOL_EVENTS = new Set([
  'TOOL_RESPONSE_AI',
  'TOOL_COPILOT',
  'TOOL_REWRITE',
  'TOOL_PDF',
  'TOOL_AUDIO',
  'TOOL_CREDIT',
  'TOOL_BULK_SEND',
  'TOOL_MAPS_LEADS',
  'TOOL_EXTRACT_CONTACTS',
  'TOOL_HERO3D'
]);

const INSIGHT_EVENTS = new Set(['EVENT_INSIGHT']);

const INSIGHT_POPUP_SELECTORS = [
  '#heroia-analysis-panel',
  '#heroia-analysis-panel.heroia-panel-rewrite',
  '#hero-insight-popup',
  '.hero-insight-popup',
  '[data-hero-insight-popup]',
  '[data-testid="hero-insight-popup"]',
  '[data-testid*="insight"][data-testid*="hero"]',
  '.heroia-insight-popup',
  '.hero-insight',
  '.heroia-insight',
  '[id*="hero"][id*="insight"]',
  '[class*="hero"][class*="insight"]'
];

const TOOL_BUTTON_TO_EVENT = {
  'hero-btn-core-draft': 'TOOL_RESPONSE_AI',
  'hero-btn-core-follow': 'TOOL_COPILOT',
  'hero-btn-refine': 'TOOL_REWRITE',
  'hero-btn-pdf': 'TOOL_PDF',
  'hero-btn-audio': 'TOOL_AUDIO',
  'hero-btn-credito': 'TOOL_CREDIT',
  'hero-btn-disparo': 'TOOL_BULK_SEND',
  'hero-btn-gerar-leads': 'TOOL_MAPS_LEADS',
  'hero-btn-extrair-contatos': 'TOOL_EXTRACT_CONTACTS',
  'hero-btn-hero3d-print-otimizador': 'TOOL_HERO3D'
};

const TOOL_EVENT_META = {
  TOOL_RESPONSE_AI: { label: 'Response AI', icon: 'AI', color: '#6cc7ff' },
  TOOL_COPILOT: { label: 'Copilot', icon: 'CP', color: '#80d9ff' },
  TOOL_REWRITE: { label: 'Rewrite', icon: 'RW', color: '#6bd7c4' },
  TOOL_PDF: { label: 'PDF', icon: 'PDF', color: '#ff9c7a' },
  TOOL_AUDIO: { label: 'Audio', icon: 'AU', color: '#9cc7ff' },
  TOOL_CREDIT: { label: 'Credit', icon: 'CR', color: '#ffd86b' },
  TOOL_BULK_SEND: { label: 'Bulk Send', icon: 'BS', color: '#86f3b3' },
  TOOL_MAPS_LEADS: { label: 'Maps Leads', icon: 'ML', color: '#98e1ff' },
  TOOL_EXTRACT_CONTACTS: { label: 'Extract Contacts', icon: 'EC', color: '#e9a6ff' },
  TOOL_HERO3D: { label: 'HERO3D', icon: '3D', color: '#99f2ff' }
};

const INSIGHT_EVENT_META = {
  EVENT_INSIGHT: { label: 'Insight', icon: 'IN', color: '#c98bff' }
};

const HERO_TOOL_BUTTON_SELECTORS = Object.keys(TOOL_BUTTON_TO_EVENT).map((id) => `#${id}`);

const OVERLAY_STATE_COLORS = {
  BOOT: '#5fa8ff',
  READY: '#6dd7a5',
  IDLE: '#9aa4b2',
  THINKING: '#f6c26c',
  WRITING: '#8fbeff',
  SUCCESS: '#4ce38e',
  ERROR: '#ff7676',
  HOT_LEAD: '#ff9f43',
  SLEEP: '#95a0ff',
  OFFLINE: '#b0b0b0'
};

const MESSAGE_BOX_SELECTORS = [
  'footer div[contenteditable="true"]',
  'div[contenteditable="true"][role="textbox"]',
  'div[contenteditable="true"][data-tab]',
  '[aria-label*="Digite uma mensagem"]',
  '[aria-label*="Type a message"]',
  '[aria-label*="Digite"]',
  '[aria-label*="mensagem"]'
];

const SEND_BUTTON_SELECTORS = [
  'button[data-icon="send"]',
  'button[aria-label*="Send"]',
  'button[aria-label*="Enviar"]',
  '[data-icon="send"]',
  '[aria-label*="Send"]',
  '[aria-label*="Enviar"]'
];

function log(...args) {
  console.log('[HERO.Bot][DOM]', ...args);
}

function findElement(selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element instanceof HTMLElement) {
      return element;
    }
  }
  return null;
}

function findMessageBox() {
  return findElement(MESSAGE_BOX_SELECTORS);
}

function getClosestSendButton(target) {
  if (!(target instanceof Element)) {
    return null;
  }
  return target.closest(SEND_BUTTON_SELECTORS.join(','));
}

function getClosestHeroToolButton(target) {
  if (!(target instanceof Element)) {
    return null;
  }

  const button = target.closest(HERO_TOOL_BUTTON_SELECTORS.join(','));
  if (!(button instanceof HTMLElement) || !button.id) {
    return null;
  }

  return button;
}

function getMessageBoxText() {
  const messageBox = findMessageBox();
  if (!messageBox) {
    return '';
  }
  return messageBox.innerText.trim();
}

function sendInteraction(action, detail = {}) {
  if (!extensionRuntimeAvailable) {
    log('extension runtime unavailable due to page unload, skipping interaction', action, detail);
    return;
  }

  log('interaction', action, detail);
  try {
    if (!chrome?.runtime?.sendMessage) {
      log('chrome.runtime.sendMessage unavailable, skipping interaction', action);
      return;
    }

    chrome.runtime.sendMessage(
      {
        type: 'hero_interaction',
        action,
        detail
      },
      () => {
        if (chrome.runtime.lastError) {
          const message = String(chrome.runtime.lastError.message || 'unknown error');
          log('chrome.runtime.sendMessage error:', message, action, detail);

          if (
            message.includes('Extension context invalidated') ||
            message.includes('Could not establish connection') ||
            message.includes('Receiving end does not exist')
          ) {
            log('transient runtime error, keeping content script active');
            return;
          }

          extensionRuntimeAvailable = false;
        }
      }
    );
  } catch (error) {
    log('sendInteraction exception:', error.message || error);
  }
}

function sendToolClick(buttonId, detail = {}) {
  if (!extensionRuntimeAvailable || !buttonId) {
    return;
  }

  const toolEvent = TOOL_BUTTON_TO_EVENT[buttonId];
  if (!toolEvent) {
    return;
  }

  log('tool click', buttonId, toolEvent, detail);

  chrome.runtime.sendMessage(
    {
      type: 'hero_tool_click',
      buttonId,
      toolEvent,
      reason: 'hero_tool_button_click',
      detail
    },
    () => {
      if (chrome.runtime.lastError) {
        log('tool click send error:', chrome.runtime.lastError.message);
      }
    }
  );
}

function sendToolProgress(progressType, reason) {
  if (!extensionRuntimeAvailable) {
    return;
  }

  chrome.runtime.sendMessage(
    {
      type: 'hero_tool_progress',
      progressType,
      reason
    },
    () => {
      if (chrome.runtime.lastError) {
        // Ignore transient delivery errors from inactive tabs/background reload.
      }
    }
  );
}

function isElementVisible(element) {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return rect.width > 2 && rect.height > 2;
}

function isLilacColor(colorText) {
  if (!colorText || typeof colorText !== 'string') {
    return false;
  }

  const match = colorText.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) {
    return false;
  }

  const red = Number(match[1]);
  const green = Number(match[2]);
  const blue = Number(match[3]);
  return red >= 110 && blue >= 150 && blue > red && green >= 70 && green <= 210;
}

function findVisibleInsightPopup() {
  for (const selector of INSIGHT_POPUP_SELECTORS) {
    const candidate = document.querySelector(selector);
    if (candidate instanceof HTMLElement && isElementVisible(candidate)) {
      return { visible: true, selectorHint: selector };
    }
  }

  const dialogs = document.querySelectorAll('[role="dialog"], [class*="popup"], [class*="modal"]');
  for (const element of dialogs) {
    if (!(element instanceof HTMLElement) || !isElementVisible(element)) {
      continue;
    }

    const style = window.getComputedStyle(element);
    const hasLilacSurface = isLilacColor(style.backgroundColor) || isLilacColor(style.borderColor);
    if (hasLilacSurface) {
      return { visible: true, selectorHint: 'lilac_dialog_fallback' };
    }
  }

  return { visible: false, selectorHint: '' };
}

function notifyInsightVisibilityIfChanged(reason) {
  const result = findVisibleInsightPopup();
  if (lastInsightPopupVisible === result.visible) {
    return;
  }

  lastInsightPopupVisible = result.visible;
  if (overlayDebugTimelineEnabled || overlayDebugTimelineByUrl) {
    log('insight popup visibility', {
      visible: result.visible,
      reason,
      selectorHint: result.selectorHint
    });
  }

  chrome.runtime.sendMessage(
    {
      type: 'hero_insight_visibility',
      visible: result.visible,
      reason,
      selectorHint: result.selectorHint
    },
    () => {
      if (chrome.runtime.lastError) {
        log('insight visibility send error:', chrome.runtime.lastError.message);
      }
    }
  );
}

function attachMessageBoxListeners() {
  const messageBox = findMessageBox();
  if (!messageBox || messageBox.__heroMapperAttached) {
    return;
  }

  messageBox.__heroMapperAttached = true;
  messageBox.addEventListener('pointerenter', () => {
    sendInteraction('composition_mouse_enter', { reason: 'pointerenter' });
  }, true);
}

function isInsideMessageBox(target) {
  if (!(target instanceof Element)) {
    return false;
  }
  const messageBox = findMessageBox();
  return messageBox ? messageBox.contains(target) : false;
}

function sendUserTyping(key) {
  if (key === 'Backspace' || key === 'Delete') {
    sendInteraction('deleted_text', {});
    return;
  }
  sendInteraction('typed_key', {});
}

function sendContentChanged() {
  sendInteraction('content_changed', {});
  sendToolProgress('writing_detected', 'composer_content_changed');
}

function handleSendDetected(reason, action = 'send_button_click') {
  log('send detected', reason);
  sendInteraction(action, { reason });
}

function scheduleSendCheck() {
  clearTimeout(sendCheckTimer);
  sendCheckTimer = setTimeout(() => {
    const currentText = getMessageBoxText();
    if (
      lastInteractionWasTyping &&
      lastMessageText &&
      currentText === '' &&
      Date.now() - lastInteractionTime < 3000
    ) {
      log('message box cleared after typing, assuming send');
      handleSendDetected('message_box_cleared');
    }
    lastMessageText = currentText;
  }, 120);
}

function isModifierKey(event) {
  return [
    'Shift',
    'Control',
    'Alt',
    'Meta',
    'CapsLock',
    'Tab',
    'Escape',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'Home',
    'End',
    'PageUp',
    'PageDown',
    'Insert',
    'Delete'
  ].includes(event.key);
}

function handleEvent(event) {
  const target = event.target;

  if (event.type === 'focusin' && isInsideMessageBox(target)) {
    sendInteraction('composition_focus', { reason: 'focusin_message_box' });
    return;
  }

  if (event.type === 'click') {
    const heroToolButton = getClosestHeroToolButton(target);
    if (heroToolButton) {
      sendToolClick(heroToolButton.id, {
        source: 'dom_click',
        text: (heroToolButton.textContent || '').trim().slice(0, 48)
      });
      return;
    }

    const sendButton = getClosestSendButton(target);
    if (sendButton) {
      handleSendDetected('send_button_click', 'send_button_click');
      return;
    }

    if (isInsideMessageBox(target)) {
      sendInteraction('composition_mouse_enter', { reason: 'click_message_box' });
      return;
    }
    return;
  }

  const messageBox = findMessageBox();
  if (!messageBox || !messageBox.contains(target)) {
    return;
  }

  if (event.type === 'keydown') {
    if (event.key === 'Enter' && !event.shiftKey) {
      handleSendDetected('enter_key_send', 'enter_key_send');
      return;
    }
    if (!isModifierKey(event)) {
      lastInteractionWasTyping = true;
      lastInteractionTime = Date.now();
      sendUserTyping(event.key);
    }
    return;
  }

  if (event.type === 'input') {
    const currentText = getMessageBoxText();
    if (currentText !== lastMessageText) {
      if (currentText.length < lastMessageText.length) {
        sendInteraction('deleted_text', {});
        sendToolProgress('writing_detected', 'composer_deleted_text');
      } else {
        sendContentChanged();
      }
      lastMessageText = currentText;
    }
    return;
  }

  if (event.type === 'paste') {
    const currentText = getMessageBoxText();
    sendContentChanged();
    lastMessageText = currentText;
    return;
  }

  if (event.type === 'keyup') {
    const currentText = getMessageBoxText();
    if (currentText !== lastMessageText) {
      sendContentChanged();
      lastMessageText = currentText;
    }
    return;
  }
}

function loadOverlayPosition() {
  try {
    const raw = localStorage.getItem(OVERLAY_STORAGE_KEY);
    if (!raw) {
      return { top: 16, right: 16 };
    }
    const parsed = JSON.parse(raw);
    if (typeof parsed.top !== 'number' || typeof parsed.left !== 'number') {
      return { top: 16, right: 16 };
    }
    return { top: parsed.top, left: parsed.left };
  } catch {
    return { top: 16, right: 16 };
  }
}

function saveOverlayPosition(top, left) {
  try {
    localStorage.setItem(OVERLAY_STORAGE_KEY, JSON.stringify({ top, left }));
  } catch {
    // Ignore local storage errors for overlay position persistence.
  }
}

function setOverlayMinimized(minimized) {
  if (!heroOverlay || !heroOverlayBodyEl || !heroOverlayMinimizeEl) {
    return;
  }

  heroOverlayBodyEl.style.display = minimized ? 'none' : 'flex';
  heroOverlay.style.paddingBottom = minimized ? '8px' : '12px';
  heroOverlayMinimizeEl.textContent = minimized ? '+' : '-';
  heroOverlay.dataset.minimized = minimized ? '1' : '0';
}

function resetToolFlow() {
  activeToolFlow = [];
  if (heroOverlayFlowEl) {
    heroOverlayFlowEl.textContent = '';
    heroOverlayFlowEl.style.display = 'none';
  }
}

function pushToolFlowState(nextState) {
  if (!heroOverlayFlowEl) {
    return;
  }

  if (!overlayDebugTimelineEnabled && !overlayDebugTimelineByUrl) {
    resetToolFlow();
    return;
  }

  if (!activeToolFlow.length || activeToolFlow[activeToolFlow.length - 1] !== nextState) {
    activeToolFlow.push(nextState);
    if (activeToolFlow.length > TOOL_FLOW_MAX_STEPS) {
      activeToolFlow = activeToolFlow.slice(activeToolFlow.length - TOOL_FLOW_MAX_STEPS);
    }
  }

  heroOverlayFlowEl.style.display = 'block';
  heroOverlayFlowEl.style.opacity = '0';
  heroOverlayFlowEl.textContent = activeToolFlow.join(' -> ');
  requestAnimationFrame(() => {
    if (!heroOverlayFlowEl) {
      return;
    }
    heroOverlayFlowEl.style.opacity = '1';
  });
}

function updateOverlayState(nextState, payload = {}) {
  if (!heroOverlayStateEl || !heroOverlayDotEl || !heroOverlayIconEl || !heroOverlaySubEl) {
    return;
  }

  const isToolLayer = payload?.layer === 'HERO_TOOL_EVENTS';
  const isInsightLayer = payload?.layer === 'HERO_INSIGHT_EVENTS';

  if (TOOL_EVENTS.has(nextState) || (isToolLayer && OVERLAY_STATES.has(nextState))) {
    const meta = TOOL_EVENT_META[nextState] || {
      label: nextState,
      icon: 'TOOL',
      color: '#74ccff'
    };

    const displayLabel = TOOL_EVENTS.has(nextState) ? meta.label : nextState;
    heroOverlayStateEl.textContent = displayLabel;
    heroOverlayIconEl.textContent = payload?.toolIcon || meta.icon;
    heroOverlaySubEl.textContent = 'HERO Tool Event';
    heroOverlaySubEl.style.color = '#9bc4ff';
    heroOverlayIconEl.style.display = 'inline-flex';
    heroOverlayIconEl.style.background = 'rgba(116, 204, 255, 0.18)';
    const color = meta.color;
    heroOverlayDotEl.style.background = color;
    heroOverlayDotEl.style.boxShadow = `0 0 10px ${color}`;

    if (TOOL_EVENTS.has(nextState)) {
      activeToolFlow = [];
    }
    pushToolFlowState(nextState);
    return;
  }

  if (INSIGHT_EVENTS.has(nextState) || (isInsightLayer && nextState === 'EVENT_INSIGHT')) {
    const meta = INSIGHT_EVENT_META[nextState] || {
      label: 'Insight',
      icon: 'IN',
      color: '#c98bff'
    };

    heroOverlayStateEl.textContent = meta.label;
    heroOverlayIconEl.textContent = meta.icon;
    heroOverlaySubEl.textContent = 'HERO Insight Event';
    heroOverlaySubEl.style.color = '#c7a8ff';
    heroOverlayIconEl.style.display = 'inline-flex';
    heroOverlayIconEl.style.background = 'rgba(201, 139, 255, 0.18)';
    heroOverlayDotEl.style.background = meta.color;
    heroOverlayDotEl.style.boxShadow = `0 0 10px ${meta.color}`;
    return;
  }

  if (isInsightLayer && nextState === 'READY') {
    heroOverlayStateEl.textContent = 'READY';
    heroOverlayIconEl.textContent = 'IN';
    heroOverlaySubEl.textContent = 'HERO Insight Event';
    heroOverlaySubEl.style.color = '#c7a8ff';
    heroOverlayIconEl.style.display = 'inline-flex';
    heroOverlayIconEl.style.background = 'rgba(201, 139, 255, 0.18)';
    heroOverlayDotEl.style.background = '#c98bff';
    heroOverlayDotEl.style.boxShadow = '0 0 10px #c98bff';
    return;
  }

  const safeState = OVERLAY_STATES.has(nextState) ? nextState : 'READY';
  heroOverlayStateEl.textContent = safeState;
  heroOverlayIconEl.style.display = 'none';
  heroOverlaySubEl.textContent = 'Mini Overlay';
  heroOverlaySubEl.style.color = '#8f93a3';
  resetToolFlow();
  const color = OVERLAY_STATE_COLORS[safeState] || OVERLAY_STATE_COLORS.READY;
  heroOverlayDotEl.style.background = color;
  heroOverlayDotEl.style.boxShadow = `0 0 10px ${color}`;
}

function createOverlayElement() {
  if (heroOverlay) {
    return heroOverlay;
  }

  const root = document.createElement('div');
  root.id = 'hero-bot-mini-overlay';
  root.style.position = 'fixed';
  root.style.top = '16px';
  root.style.right = '16px';
  root.style.width = '180px';
  root.style.background = '#070707';
  root.style.border = '1px solid #1e1e1e';
  root.style.borderRadius = '16px';
  root.style.padding = '10px 10px 12px 10px';
  root.style.boxShadow = '0 14px 34px rgba(0,0,0,0.58)';
  root.style.zIndex = '2147483647';
  root.style.color = '#f6f7fb';
  root.style.fontFamily = 'Segoe UI, Tahoma, sans-serif';
  root.style.userSelect = 'none';
  root.style.backdropFilter = 'blur(1px)';

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';
  header.style.cursor = 'move';
  header.style.gap = '8px';

  const title = document.createElement('div');
  title.textContent = 'HERO.Bot';
  title.style.fontSize = '12px';
  title.style.letterSpacing = '0.08em';
  title.style.textTransform = 'uppercase';
  title.style.opacity = '0.95';
  title.style.fontWeight = '700';

  const controls = document.createElement('div');
  controls.style.display = 'flex';
  controls.style.gap = '6px';

  const minimize = document.createElement('button');
  minimize.type = 'button';
  minimize.textContent = '-';
  minimize.title = 'Minimizar';
  minimize.style.width = '20px';
  minimize.style.height = '20px';
  minimize.style.border = 'none';
  minimize.style.borderRadius = '6px';
  minimize.style.background = '#1e1e1e';
  minimize.style.color = '#e6e6e6';
  minimize.style.cursor = 'pointer';

  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'x';
  close.title = 'Fechar';
  close.style.width = '20px';
  close.style.height = '20px';
  close.style.border = 'none';
  close.style.borderRadius = '6px';
  close.style.background = '#281616';
  close.style.color = '#ffb6b6';
  close.style.cursor = 'pointer';

  controls.appendChild(minimize);
  controls.appendChild(close);
  header.appendChild(title);
  header.appendChild(controls);

  const body = document.createElement('div');
  body.style.display = 'flex';
  body.style.flexDirection = 'column';
  body.style.marginTop = '10px';
  body.style.gap = '8px';

  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.gap = '8px';

  const icon = document.createElement('span');
  icon.style.minWidth = '24px';
  icon.style.height = '18px';
  icon.style.display = 'none';
  icon.style.alignItems = 'center';
  icon.style.justifyContent = 'center';
  icon.style.borderRadius = '6px';
  icon.style.fontSize = '10px';
  icon.style.fontWeight = '700';
  icon.style.letterSpacing = '0.04em';
  icon.style.color = '#d8eeff';

  const dot = document.createElement('span');
  dot.style.width = '10px';
  dot.style.height = '10px';
  dot.style.borderRadius = '999px';
  dot.style.background = OVERLAY_STATE_COLORS.READY;
  dot.style.boxShadow = `0 0 10px ${OVERLAY_STATE_COLORS.READY}`;
  dot.style.animation = 'heroBotPulse 1.6s ease-in-out infinite';

  const label = document.createElement('span');
  label.textContent = 'READY';
  label.style.fontSize = '12px';
  label.style.fontWeight = '700';
  label.style.letterSpacing = '0.07em';

  const sub = document.createElement('div');
  sub.textContent = 'Mini Overlay';
  sub.style.fontSize = '11px';
  sub.style.color = '#8f93a3';

  const flow = document.createElement('div');
  flow.style.display = 'none';
  flow.style.fontSize = '10px';
  flow.style.lineHeight = '1.2';
  flow.style.color = '#9bc4ff';
  flow.style.wordBreak = 'break-word';
  flow.style.opacity = '1';
  flow.style.transition = 'opacity 180ms ease';

  row.appendChild(dot);
  row.appendChild(icon);
  row.appendChild(label);
  body.appendChild(row);
  body.appendChild(sub);
  body.appendChild(flow);

  root.appendChild(header);
  root.appendChild(body);

  const style = document.createElement('style');
  style.id = 'hero-bot-mini-overlay-style';
  style.textContent = '@keyframes heroBotPulse { 0% { transform: scale(0.9); opacity: 0.7; } 50% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(0.9); opacity: 0.7; } }';
  document.head.appendChild(style);

  minimize.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const isMinimized = root.dataset.minimized === '1';
    setOverlayMinimized(!isMinimized);
  });

  close.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    overlayEnabled = false;
    removeOverlay();
  });

  header.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) {
      return;
    }

    if (!(event.target instanceof HTMLElement)) {
      return;
    }

    if (event.target === minimize || event.target === close) {
      return;
    }

    const rect = root.getBoundingClientRect();
    overlayDrag = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top
    };

    header.setPointerCapture(event.pointerId);
  });

  header.addEventListener('pointermove', (event) => {
    if (!overlayDrag || overlayDrag.pointerId !== event.pointerId) {
      return;
    }

    const top = Math.max(8, Math.min(window.innerHeight - root.offsetHeight - 8, event.clientY - overlayDrag.offsetY));
    const left = Math.max(8, Math.min(window.innerWidth - root.offsetWidth - 8, event.clientX - overlayDrag.offsetX));
    root.style.top = `${top}px`;
    root.style.left = `${left}px`;
    root.style.right = 'auto';
  });

  header.addEventListener('pointerup', (event) => {
    if (!overlayDrag || overlayDrag.pointerId !== event.pointerId) {
      return;
    }

    const rect = root.getBoundingClientRect();
    saveOverlayPosition(rect.top, rect.left);
    overlayDrag = null;
    header.releasePointerCapture(event.pointerId);
  });

  header.addEventListener('pointercancel', (event) => {
    if (!overlayDrag || overlayDrag.pointerId !== event.pointerId) {
      return;
    }
    overlayDrag = null;
    header.releasePointerCapture(event.pointerId);
  });

  heroOverlay = root;
  heroOverlayStateEl = label;
  heroOverlayDotEl = dot;
  heroOverlayIconEl = icon;
  heroOverlayCloseEl = close;
  heroOverlayMinimizeEl = minimize;
  heroOverlayBodyEl = body;
  heroOverlaySubEl = sub;
  heroOverlayFlowEl = flow;
  return root;
}

function renderOverlay() {
  if (!overlayEnabled) {
    removeOverlay();
    return;
  }

  const overlay = createOverlayElement();
  if (!overlay.isConnected) {
    const pos = loadOverlayPosition();
    overlay.style.top = `${pos.top}px`;
    if (typeof pos.left === 'number') {
      overlay.style.left = `${pos.left}px`;
      overlay.style.right = 'auto';
    } else {
      overlay.style.right = '16px';
      overlay.style.left = 'auto';
    }

    (document.body || document.documentElement).appendChild(overlay);
  }
}

function removeOverlay() {
  if (heroOverlay?.parentNode) {
    heroOverlay.parentNode.removeChild(heroOverlay);
  }
}

function setupOverlayMessaging() {
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'hero_overlay_config') {
      overlayEnabled = Boolean(message.enabled);
      overlayDebugTimelineEnabled = Boolean(message.debugTimeline);
      if (overlayEnabled) {
        renderOverlay();
      } else {
        removeOverlay();
      }
      return;
    }

    if (message?.type === 'hero_overlay_state') {
      const shouldRender = Boolean(message.settings?.showMiniOverlay ?? overlayEnabled);
      overlayEnabled = shouldRender;
      overlayDebugTimelineEnabled = Boolean(message.settings?.overlayDebugTimeline);
      if (overlayEnabled) {
        renderOverlay();
        updateOverlayState(message.state || 'READY', message.payload || {});
      } else {
        removeOverlay();
      }
    }
  });

  chrome.runtime.sendMessage({ type: 'request_overlay_sync' }, (response) => {
    if (chrome.runtime.lastError) {
      return;
    }

    const enabled = Boolean(response?.settings?.showMiniOverlay);
    overlayEnabled = enabled;
    overlayDebugTimelineEnabled = Boolean(response?.settings?.overlayDebugTimeline);
    if (enabled) {
      renderOverlay();
      updateOverlayState(response?.currentState || 'READY', {});
    } else {
      removeOverlay();
    }
  });
}

function setupDocumentDelegation() {
  const events = ['focusin', 'click', 'input', 'paste', 'keydown', 'keyup'];
  for (const type of events) {
    document.addEventListener(type, handleEvent, true);
  }
}

function setupWindowListeners() {
  window.addEventListener('blur', () => {
    sendInteraction('window_blur', {});
  });

  window.addEventListener('unload', () => {
    extensionRuntimeAvailable = false;
  });

  window.addEventListener('pagehide', () => {
    extensionRuntimeAvailable = false;
  });
}

function setupMutationObserver() {
  const target = document.body;
  if (!target) {
    return;
  }

  const observer = new MutationObserver((mutations) => {
    const messageBox = findMessageBox();
    if (!messageBox) {
      return;
    }

    attachMessageBoxListeners();
    const currentText = getMessageBoxText();
    if (lastMessageText && currentText === '' && Date.now() - lastInteractionTime < 3000) {
      log('message box cleared after mutation, checking for send');
      sendInteraction('enter_key_send', { reason: 'message_box_cleared' });
      lastMessageText = currentText;
      return;
    }

    for (const mutation of mutations) {
      if (mutation.type === 'characterData') {
        const parent = mutation.target.parentElement;
        if (parent?.closest('footer, [data-testid="conversation-panel-messages"], #main, #pane-side')) {
          log('mutation detected (characterData)');
          sendInteraction('content_changed', { reason: 'dom_characterData' });
          sendToolProgress('writing_detected', 'dom_characterData');
          break;
        }
      }

      const nodes = [...mutation.addedNodes, ...mutation.removedNodes];
      for (const node of nodes) {
        if (!(node instanceof HTMLElement)) {
          continue;
        }
        if (node.closest('footer, [data-testid="conversation-panel-messages"], #main, #pane-side')) {
          log('mutation detected (node change)');
          sendInteraction('content_changed', { reason: 'dom_node_change' });
          sendToolProgress('writing_detected', 'dom_node_change');
          break;
        }
      }
    }

    lastMessageText = currentText;
    notifyInsightVisibilityIfChanged('dom_mutation');
  });

  observer.observe(target, { childList: true, subtree: true, characterData: true });
}

function setupInsightPopupObserver() {
  const target = document.body;
  if (!target) {
    return;
  }

  notifyInsightVisibilityIfChanged('init_scan');

  const observer = new MutationObserver(() => {
    notifyInsightVisibilityIfChanged('insight_popup_mutation');
  });

  observer.observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
}

function init() {
  log('content script loaded');
  const messageBox = findMessageBox();
  if (messageBox) {
    log('message box found', messageBox);
    attachMessageBoxListeners();
  } else {
    log('message box not found yet');
  }
  lastMessageText = getMessageBoxText();
  setupDocumentDelegation();
  setupWindowListeners();
  setupMutationObserver();
  setupInsightPopupObserver();
  setupOverlayMessaging();
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  sendInteraction('whatsapp_loaded', {});
  init();
} else {
  window.addEventListener('load', () => {
    sendInteraction('whatsapp_loaded', {});
    setTimeout(init, 1500);
  });
}
