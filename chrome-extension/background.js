import { HeroInteractionMapper } from './hero-interaction-mapper.js';
import { ToolEventMapper } from './tool-event-mapper.js';
import { InsightEventMapper } from './insight-event-mapper.js';
import { createDeviceBridge } from './device-bridge.js';

const WS_URL = 'ws://127.0.0.1:8765';
const RECONNECT_MIN_DELAY_MS = 2000;
const RECONNECT_MAX_DELAY_MS = 60000;
const MAX_PENDING_EVENTS = 25;
const PENDING_EVENT_TTL_MS = 30000;
const DEFAULT_SETTINGS = {
  showMiniOverlay: true,
  sendToSimulator: true,
  overlayDebugTimeline: false,
  deviceBridgeEnabled: false,
  deviceBridgeTransport: 'ws',
  deviceBridgeHost: '',
  deviceBridgePort: 8766,
  deviceBridgeDebug: false
};

let ws = null;
let reconnectTimer = null;
let reconnectDelayMs = RECONNECT_MIN_DELAY_MS;
let status = 'Disconnected';
let pendingEvents = [];
let settings = { ...DEFAULT_SETTINGS };
let deviceBridge = null;
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
    initDeviceBridgeShadowMode();
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
        overlayDebugTimeline: Boolean(stored?.overlayDebugTimeline),
        deviceBridgeEnabled: Boolean(stored?.deviceBridgeEnabled),
        deviceBridgeTransport: stored?.deviceBridgeTransport || 'ws',
        deviceBridgeHost: stored?.deviceBridgeHost || '',
        deviceBridgePort: Number(stored?.deviceBridgePort || 8766),
        deviceBridgeDebug: Boolean(stored?.deviceBridgeDebug)
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

function getDeviceBridgeOptions() {
  return {
    enabled: Boolean(settings.deviceBridgeEnabled),
    debug: Boolean(settings.deviceBridgeDebug),
    transport: settings.deviceBridgeTransport || 'ws',
    ws: {
      enabled: Boolean(settings.deviceBridgeEnabled) && (settings.deviceBridgeTransport || 'ws') === 'ws',
      host: settings.deviceBridgeHost || '',
      port: Number(settings.deviceBridgePort || 8766)
    },
    ble: {
      enabled: Boolean(settings.deviceBridgeEnabled) && (settings.deviceBridgeTransport || 'ws') === 'ble'
    }
  };
}

function syncDeviceBridge() {
  if (!deviceBridge) {
    return;
  }

  deviceBridge.updateConfig(getDeviceBridgeOptions());
}

function initDeviceBridgeShadowMode() {
  if (deviceBridge) {
    return;
  }

  deviceBridge = createDeviceBridge(heroEventBus, getDeviceBridgeOptions());
  if (settings.deviceBridgeDebug) {
    log('DeviceBridge shadow mode ready');
  }
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
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return;
  }

  prunePendingEvents();
  if (!pendingEvents.length) {
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
      const failedSocket = ws;
      ws = null;
      if (failedSocket) {
        try {
          failedSocket.close();
        } catch (_) {}
      }
      scheduleReconnect();
      break;
    }
  }
}

function prunePendingEvents(now = Date.now()) {
  pendingEvents = pendingEvents.filter((event) => {
    const timestamp = Number(event?.timestamp || 0);
    return timestamp > 0 && now - timestamp <= PENDING_EVENT_TTL_MS;
  });
}

function queuePendingEvent(event) {
  prunePendingEvents();

  const previous = pendingEvents[pendingEvents.length - 1];
  if (previous?.type === event?.type && previous?.payload?.layer === event?.payload?.layer) {
    pendingEvents[pendingEvents.length - 1] = event;
    return;
  }

  pendingEvents.push(event);
  if (pendingEvents.length > MAX_PENDING_EVENTS) {
    pendingEvents.splice(0, pendingEvents.length - MAX_PENDING_EVENTS);
  }
}

function scheduleReconnect() {
  if (!settings.sendToSimulator || reconnectTimer) {
    return;
  }

  const jitterMs = Math.floor(Math.random() * Math.min(1000, reconnectDelayMs / 4));
  const waitMs = reconnectDelayMs + jitterMs;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, waitMs);
  reconnectDelayMs = Math.min(RECONNECT_MAX_DELAY_MS, reconnectDelayMs * 2);
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
  const socket = new WebSocket(WS_URL);
  ws = socket;

  socket.addEventListener('open', () => {
    if (ws !== socket) return;
    log('WebSocket connected');
    reconnectDelayMs = RECONNECT_MIN_DELAY_MS;
    updateStatus('Connected');
    flushPendingEvents();
  });

  socket.addEventListener('close', () => {
    if (ws !== socket) return;
    log('WebSocket disconnected');
    ws = null;
    updateStatus('Disconnected');
    scheduleReconnect();
  });

  socket.addEventListener('error', (error) => {
    if (ws !== socket) return;
    log('WebSocket error', error);
    ws = null;
    updateStatus('Disconnected');
    socket.close();
    scheduleReconnect();
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
      queuePendingEvent(event);
      const failedSocket = ws;
      ws = null;
      if (failedSocket) {
        try {
          failedSocket.close();
        } catch (_) {}
      }
      scheduleReconnect();
    }
  } else {
    log('Queueing event because WebSocket is not open');
    queuePendingEvent(event);
    if (!reconnectTimer) {
      connect();
    }
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
      ...settings,
      showMiniOverlay: Boolean(message.settings?.showMiniOverlay),
      sendToSimulator: Boolean(message.settings?.sendToSimulator),
      overlayDebugTimeline: Boolean(message.settings?.overlayDebugTimeline)
    };

    saveSettings(nextSettings).then(() => {
      syncDeviceBridge();
      if (!settings.sendToSimulator && ws) {
        try {
          ws.close();
        } catch (_) {}
        ws = null;
      }

      if (settings.sendToSimulator) {
        reconnectDelayMs = RECONNECT_MIN_DELAY_MS;
        updateStatus('Reconnecting');
        connect();
      } else {
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        pendingEvents = [];
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
