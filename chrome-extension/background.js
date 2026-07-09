import { HeroInteractionMapper } from './hero-interaction-mapper.js';
import { ToolEventMapper } from './tool-event-mapper.js';
import { InsightEventMapper } from './insight-event-mapper.js';

const WS_URL = 'ws://127.0.0.1:8765';
const DEFAULT_SETTINGS = {
  showMiniOverlay: true,
  sendToSimulator: true,
  overlayDebugTimeline: false
};

let ws = null;
let reconnectTimer = null;
let status = 'Disconnected';
let pendingEvents = [];
let settings = { ...DEFAULT_SETTINGS };
let heroEventBus = {
  publish: () => {},
  subscribe: () => () => {}
};

function log(...args) {
  console.log('[HERO.Bot]', ...args);
}

async function initHeroEventBusShadowMode() {
  try {
    const [busModule, typesModule, layersModule, routerModule] = await Promise.all([
      import('./hero-event-bus.js'),
      import('./hero-event-types.js'),
      import('./hero-event-layers.js'),
      import('./hero-event-router.js')
    ]);

    const bus = busModule.createHeroEventBus({ maxHistory: 300 });
    routerModule.registerDefaultHeroEventSubscribers(bus, {
      logger: (...args) => log(...args),
      enableConsoleLog: false
    });

    heroEventBus = bus;
    heroEventBus.publish({
      type: typesModule.HERO_EVENT_TYPES.STATE_DISPATCHED,
      state: 'BOOT',
      layer: layersModule.HERO_EVENT_LAYERS.OFFICIAL_STATES,
      source: 'background:init_shadow_mode'
    });
    log('HeroEventBus V1 shadow mode enabled');
  } catch (error) {
    log('HeroEventBus V1 shadow mode unavailable:', error?.message || error);
  }
}

function updateStatus(newStatus) {
  status = newStatus;
  chrome.runtime.sendMessage({ type: 'status_update', status }, () => {
    if (chrome.runtime.lastError) {
      log('No receiver for status update:', chrome.runtime.lastError.message);
    }
  });
}

function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(DEFAULT_SETTINGS, (stored) => {
      settings = {
        showMiniOverlay: Boolean(stored?.showMiniOverlay),
        sendToSimulator: Boolean(stored?.sendToSimulator),
        overlayDebugTimeline: Boolean(stored?.overlayDebugTimeline)
      };
      resolve(settings);
    });
  });
}

function saveSettings(nextSettings) {
  return new Promise((resolve) => {
    chrome.storage.local.set(nextSettings, () => {
      settings = { ...nextSettings };
      resolve(settings);
    });
  });
}

function sendOverlayConfigToTabs() {
  chrome.tabs.query({ url: ['https://web.whatsapp.com/*'] }, (tabs) => {
    for (const tab of tabs) {
      if (!tab.id) {
        continue;
      }

      chrome.tabs.sendMessage(
        tab.id,
        {
          type: 'hero_overlay_config',
          enabled: settings.showMiniOverlay,
          debugTimeline: settings.overlayDebugTimeline
        },
        () => {
          if (chrome.runtime.lastError) {
            log('overlay config delivery skipped:', chrome.runtime.lastError.message);
          }
        }
      );
    }
  });
}

function dispatchOverlayState(type, payload = {}) {
  chrome.tabs.query({ url: ['https://web.whatsapp.com/*'] }, (tabs) => {
    for (const tab of tabs) {
      if (!tab.id) {
        continue;
      }

      chrome.tabs.sendMessage(
        tab.id,
        {
          type: 'hero_overlay_state',
          state: type,
          payload,
          settings
        },
        () => {
          if (chrome.runtime.lastError) {
            log('overlay state delivery skipped:', chrome.runtime.lastError.message);
          }
        }
      );
    }
  });
}

function flushPendingEvents() {
  if (!pendingEvents.length || !ws || ws.readyState !== WebSocket.OPEN) {
    return;
  }

  log('Flushing', pendingEvents.length, 'pending events');
  while (pendingEvents.length) {
    const event = pendingEvents.shift();
    try {
      ws.send(JSON.stringify(event));
    } catch (error) {
      log('WebSocket send failed while flushing pending events:', error);
      pendingEvents.unshift(event);
      if (ws) {
        try {
          ws.close();
        } catch (_) {}
      }
      ws = null;
      connect();
      break;
    }
  }
}

function connect() {
  if (!settings.sendToSimulator) {
    updateStatus('Disabled');
    return;
  }

  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  updateStatus('Reconnecting');
  ws = new WebSocket(WS_URL);

  ws.addEventListener('open', () => {
    log('WebSocket connected');
    updateStatus('Connected');
    flushPendingEvents();
  });

  ws.addEventListener('close', () => {
    log('WebSocket disconnected');
    updateStatus('Disconnected');
    heroInteractionMapper.handleInteraction('websocket_disconnected', { reason: 'ws_close' });
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, 2000);
    }
  });

  ws.addEventListener('error', (error) => {
    log('WebSocket error', error);
    updateStatus('Disconnected');
    heroInteractionMapper.handleInteraction('internal_error', { error: error?.message || 'WebSocket error' });
    if (ws) {
      ws.close();
    }
  });
}

function sendHeroBotEvent(type, payload = {}) {
  const event = {
    type,
    source: 'chrome-extension',
    payload,
    timestamp: Date.now()
  };

  log('Sending event', event, 'wsState=', ws ? ws.readyState : 'no ws');
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(event));
    } catch (error) {
      log('WebSocket send failed:', error);
      pendingEvents.push(event);
      if (ws) {
        try {
          ws.close();
        } catch (_) {}
      }
      ws = null;
      connect();
    }
  } else {
    log('Queueing event because WebSocket is not open');
    pendingEvents.push(event);
    connect();
  }
  return event;
}

function dispatchHeroState(type, payload = {}) {
  const layer = payload?.layer || 'OFFICIAL_STATES';
  heroEventBus.publish({
    type: 'STATE_DISPATCHED',
    state: type,
    layer,
    source: 'background:dispatchHeroState',
    payload,
    timestamp: Date.now()
  });

  const event = {
    type,
    source: 'chrome-extension',
    payload,
    timestamp: Date.now()
  };

  if (settings.showMiniOverlay) {
    dispatchOverlayState(type, payload);
  }

  if (settings.sendToSimulator) {
    sendHeroBotEvent(type, payload);
  }

  insightEventMapper.handleStateDispatched(type, payload);

  return event;
}

const heroInteractionMapper = new HeroInteractionMapper(dispatchHeroState);
const toolEventMapper = new ToolEventMapper(dispatchHeroState);
const insightEventMapper = new InsightEventMapper(dispatchHeroState);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'hero_tool_click') {
    heroEventBus.publish({
      type: 'TOOL_CLICK',
      source: 'background:onMessage',
      buttonId: message.buttonId,
      toolEvent: message.toolEvent || null,
      pageUrl: sender?.url || '',
      timestamp: Date.now()
    });

    const handled = toolEventMapper.handleToolClick(message.buttonId, {
      pageUrl: sender?.url || '',
      sourceTabId: sender?.tab?.id,
      page: 'whatsapp-web',
      reason: message.reason || 'hero_tool_click'
    });

    sendResponse({ received: handled });
    return true;
  }

  if (message?.type === 'hero_tool_progress') {
    heroEventBus.publish({
      type: 'TOOL_PROGRESS',
      source: 'background:onMessage',
      progressType: message.progressType,
      reason: message.reason || '',
      pageUrl: sender?.url || '',
      timestamp: Date.now()
    });

    const handled = toolEventMapper.handleToolProgress(message.progressType, {
      source: 'chrome-extension',
      pageUrl: sender?.url || '',
      sourceTabId: sender?.tab?.id,
      trigger: message.reason || 'tool_progress'
    });
    sendResponse({ received: handled });
    return true;
  }

  if (message?.type === 'hero_interaction') {
    heroEventBus.publish({
      type: 'DOM_INTERACTION',
      source: 'background:onMessage',
      action: message.action,
      detail: message.detail || {},
      pageUrl: sender?.url || '',
      timestamp: Date.now()
    });

    heroInteractionMapper.handleInteraction(message.action, message.detail);
    sendResponse({ received: true });
    return true;
  }

  if (message?.type === 'hero_insight_visibility') {
    heroEventBus.publish({
      type: 'INSIGHT_VISIBILITY',
      source: 'background:onMessage',
      visible: Boolean(message.visible),
      reason: message.reason || '',
      selectorHint: message.selectorHint || '',
      pageUrl: sender?.url || '',
      timestamp: Date.now()
    });

    insightEventMapper.handleInsightVisibility(Boolean(message.visible), {
      source: 'chrome-extension',
      page: 'whatsapp-web',
      reason: message.reason || 'insight_popup_visibility',
      selectorHint: message.selectorHint || ''
    });
    sendResponse({ received: true });
    return true;
  }

  if (message?.type === 'send_event') {
    const event = dispatchHeroState(message.eventType, message.payload);
    sendResponse({ success: true, event });
    return true;
  }

  if (message?.type === 'get_settings') {
    sendResponse({ settings: { ...settings } });
    return true;
  }

  if (message?.type === 'update_settings') {
    const nextSettings = {
      showMiniOverlay: Boolean(message.settings?.showMiniOverlay),
      sendToSimulator: Boolean(message.settings?.sendToSimulator),
      overlayDebugTimeline: Boolean(message.settings?.overlayDebugTimeline)
    };

    saveSettings(nextSettings).then(() => {
      if (!settings.sendToSimulator && ws) {
        try {
          ws.close();
        } catch (_) {}
        ws = null;
      }

      if (settings.sendToSimulator) {
        updateStatus('Reconnecting');
        connect();
      } else {
        updateStatus('Disabled');
      }

      sendOverlayConfigToTabs();
      sendResponse({ success: true, settings: { ...settings }, status });
    });

    return true;
  }

  if (message?.type === 'request_overlay_sync') {
    sendResponse({
      success: true,
      settings: { ...settings },
      currentState: heroInteractionMapper.state
    });
    return true;
  }

  if (message?.type === 'get_status') {
    sendResponse({ status });
    return true;
  }

  return false;
});

loadSettings().then(() => {
  initHeroEventBusShadowMode();

  if (settings.sendToSimulator) {
    connect();
  } else {
    updateStatus('Disabled');
  }
  sendOverlayConfigToTabs();
});
