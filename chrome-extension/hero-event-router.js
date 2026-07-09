import { HERO_EVENT_TYPES } from './hero-event-types.js';
import { HERO_EVENT_LAYERS } from './hero-event-layers.js';

export function registerDefaultHeroEventSubscribers(eventBus, options = {}) {
  if (!eventBus || typeof eventBus.subscribe !== 'function') {
    return () => {};
  }

  const logger = typeof options.logger === 'function' ? options.logger : () => {};
  const enableConsoleLog = Boolean(options.enableConsoleLog);

  const metrics = {
    overlay: 0,
    simulator: 0,
    logger: 0
  };

  const unsubscribers = [];

  // Overlay subscriber (passive observer only).
  unsubscribers.push(eventBus.subscribe('*', (event) => {
    if (event?.type !== HERO_EVENT_TYPES.STATE_DISPATCHED) {
      return;
    }
    metrics.overlay += 1;
  }));

  // Simulator subscriber (passive observer only).
  unsubscribers.push(eventBus.subscribe('*', (event) => {
    if (event?.type !== HERO_EVENT_TYPES.STATE_DISPATCHED) {
      return;
    }
    metrics.simulator += 1;
  }));

  // Logger subscriber (passive observer only).
  unsubscribers.push(eventBus.subscribe('*', (event) => {
    metrics.logger += 1;
    if (!enableConsoleLog) {
      return;
    }

    logger('[HeroEventBus][shadow]', {
      type: event?.type,
      state: event?.state,
      layer: event?.layer || HERO_EVENT_LAYERS.UNKNOWN,
      source: event?.source || 'unknown'
    });
  }));

  return () => {
    while (unsubscribers.length) {
      const unsubscribe = unsubscribers.pop();
      try {
        unsubscribe();
      } catch (_) {
        // No-op
      }
    }
  };
}
