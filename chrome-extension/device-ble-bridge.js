// BLE bridge stub for the future HERO.Bot device path.
// This file intentionally does nothing yet and keeps the runtime silent.

export function createDeviceBleBridge(options = {}) {
  const config = {
    enabled: Boolean(options.enabled),
    debug: Boolean(options.debug)
  };

  return {
    send() {
      return false;
    },
    updateConfig(nextOptions = {}) {
      config.enabled = Boolean(nextOptions.enabled);
      config.debug = Boolean(nextOptions.debug);
    },
    dispose() {},
    getStatus() {
      return {
        enabled: config.enabled,
        connected: false,
        transport: 'ble',
        ready: false,
        stub: true
      };
    }
  };
}