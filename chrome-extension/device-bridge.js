import { createDeviceWsBridge } from './device-ws-bridge.js';
import { createDeviceBleBridge } from './device-ble-bridge.js';
import { createDeviceProtocolMessage } from './device-protocol.js';

export function createDeviceBridge(eventBus, options = {}) {
  if (!eventBus || typeof eventBus.subscribe !== 'function') {
    return createNoopBridge();
  }

  const config = normalizeOptions(options);
  const wsBridge = createDeviceWsBridge(config);
  const bleBridge = createDeviceBleBridge(config.ble);

  const unsubscribe = eventBus.subscribe('*', (event) => {
    const message = createDeviceProtocolMessage(event, config.protocol);
    wsBridge.send(message);
    bleBridge.send(message);
  });

  return {
    updateConfig(nextOptions = {}) {
      const nextConfig = normalizeOptions({ ...config, ...nextOptions });
      Object.assign(config, nextConfig);
      wsBridge.updateConfig(config);
      bleBridge.updateConfig(config.ble);
    },
    dispose() {
      try {
        unsubscribe();
      } catch (_) {
        // No-op
      }
      wsBridge.dispose();
      bleBridge.dispose();
    },
    getStatus() {
      return {
        transport: config.transport,
        ws: wsBridge.getStatus(),
        ble: bleBridge.getStatus()
      };
    }
  };
}

function normalizeOptions(options = {}) {
  const transport = options.transport || 'ws';
  const enabled = Boolean(options.enabled);

  return {
    enabled,
    debug: Boolean(options.debug),
    transport,
    ws: {
      enabled: enabled && transport === 'ws',
      host: String(options.ws?.host || '').trim(),
      port: Number(options.ws?.port || 8766)
    },
    ble: {
      enabled: enabled && transport === 'ble',
      debug: Boolean(options.ble?.debug || options.debug)
    },
    protocol: options.protocol || {}
  };
}

function createNoopBridge() {
  return {
    updateConfig() {},
    dispose() {},
    getStatus() {
      return {
        transport: 'noop',
        ws: { enabled: false, connected: false, url: null },
        ble: { enabled: false, connected: false, transport: 'ble', ready: false, stub: true }
      };
    }
  };
}