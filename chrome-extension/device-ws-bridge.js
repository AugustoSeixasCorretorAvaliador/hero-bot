import { createDeviceProtocolMessage } from './device-protocol.js';

export function createDeviceWsBridge(options = {}) {
  let config = normalizeConfig(options);
  let socket = null;
  let reconnectTimer = null;
  let pendingMessages = [];

  function debugLog(...args) {
    if (config.debug) {
      console.debug('[HERO.Bot][device-ws]', ...args);
    }
  }

  function getUrl() {
    if (!config.enabled || !config.host) {
      return null;
    }

    return `ws://${config.host}:${config.port}`;
  }

  function clearReconnectTimer() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function closeSocket() {
    if (!socket) {
      return;
    }

    try {
      socket.close();
    } catch (_) {
      // No-op: the bridge must stay silent when the device is absent.
    }
    socket = null;
  }

  function flushQueue() {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    while (pendingMessages.length) {
      const message = pendingMessages.shift();
      try {
        socket.send(JSON.stringify(message));
      } catch (error) {
        debugLog('flush failed', error?.message || error);
        pendingMessages.unshift(message);
        closeSocket();
        scheduleReconnect();
        break;
      }
    }
  }

  function scheduleReconnect() {
    if (!config.enabled || reconnectTimer) {
      return;
    }

    const url = getUrl();
    if (!url) {
      return;
    }

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, 2000);
  }

  function connect() {
    const url = getUrl();
    if (!url) {
      closeSocket();
      clearReconnectTimer();
      return;
    }

    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      socket = new WebSocket(url);
    } catch (error) {
      debugLog('connect failed', error?.message || error);
      closeSocket();
      scheduleReconnect();
      return;
    }

    socket.addEventListener('open', () => {
      debugLog('connected', url);
      flushQueue();
    });

    socket.addEventListener('close', () => {
      debugLog('closed');
      socket = null;
      scheduleReconnect();
    });

    socket.addEventListener('error', () => {
      debugLog('error');
      closeSocket();
      scheduleReconnect();
    });
  }

  function send(event) {
    if (!config.enabled) {
      return false;
    }

    const message = createDeviceProtocolMessage(event);
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify(message));
        return true;
      } catch (error) {
        debugLog('send failed', error?.message || error);
        pendingMessages.push(message);
        closeSocket();
        scheduleReconnect();
        return false;
      }
    }

    pendingMessages.push(message);
    connect();
    return false;
  }

  function updateConfig(nextOptions = {}) {
    config = normalizeConfig({ ...config, ...nextOptions });
    if (!config.enabled) {
      pendingMessages = [];
      clearReconnectTimer();
      closeSocket();
      return;
    }

    connect();
  }

  function dispose() {
    pendingMessages = [];
    clearReconnectTimer();
    closeSocket();
  }

  connect();

  return {
    send,
    updateConfig,
    dispose,
    getStatus() {
      return {
        enabled: config.enabled,
        connected: Boolean(socket && socket.readyState === WebSocket.OPEN),
        url: getUrl()
      };
    }
  };
}

function normalizeConfig(options = {}) {
  return {
    enabled: Boolean(options.enabled),
    debug: Boolean(options.debug),
    host: String(options.ws?.host || options.host || '').trim(),
    port: Number(options.ws?.port || options.port || 8766)
  };
}