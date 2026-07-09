export function createHeroEventBus(options = {}) {
  const maxHistory = Number(options.maxHistory || 200);
  const listeners = new Map();
  const history = [];
  let nextId = 1;

  function subscribe(topic, handler) {
    if (typeof handler !== 'function') {
      return () => {};
    }

    const id = nextId++;
    listeners.set(id, { topic: topic || '*', handler });
    return () => {
      listeners.delete(id);
    };
  }

  function publish(event) {
    const safeEvent = {
      ...event,
      timestamp: event?.timestamp || Date.now()
    };

    history.push(safeEvent);
    if (history.length > maxHistory) {
      history.shift();
    }

    for (const { topic, handler } of listeners.values()) {
      if (topic !== '*' && topic !== safeEvent.type) {
        continue;
      }

      try {
        handler(safeEvent);
      } catch (_) {
        // Shadow subscribers should never break runtime behavior.
      }
    }
  }

  function getHistory() {
    return [...history];
  }

  function clearHistory() {
    history.length = 0;
  }

  return {
    subscribe,
    publish,
    getHistory,
    clearHistory
  };
}
