import { HeroInteractionMapper } from './hero-interaction-mapper.js';

const WS_URL = 'ws://127.0.0.1:8765';
let ws = null;
let reconnectTimer = null;
let status = 'Disconnected';
let pendingEvents = [];

function log(...args) {
  console.log('[HERO.Bot]', ...args);
}

function updateStatus(newStatus) {
  status = newStatus;
  chrome.runtime.sendMessage({ type: 'status_update', status }, () => {
    if (chrome.runtime.lastError) {
      log('No receiver for status update:', chrome.runtime.lastError.message);
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

const heroInteractionMapper = new HeroInteractionMapper(sendHeroBotEvent);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'hero_interaction') {
    heroInteractionMapper.handleInteraction(message.action, message.detail);
    sendResponse({ received: true });
    return true;
  }

  if (message?.type === 'send_event') {
    const event = sendHeroBotEvent(message.eventType, message.payload);
    sendResponse({ success: true, event });
    return true;
  }

  if (message?.type === 'get_status') {
    sendResponse({ status });
    return true;
  }

  return false;
});

connect();
