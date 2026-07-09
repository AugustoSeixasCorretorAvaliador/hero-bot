const ENVELOPE_SOURCE = 'hero-event-bus';

export function createDeviceProtocolMessage(event = {}, options = {}) {
  const payload = options.payload || buildPayload(event);

  return {
    type: options.type || event.state || event.type || 'READY',
    layer: options.layer || event.layer || 'operational',
    source: options.source || ENVELOPE_SOURCE,
    timestamp: Number(options.timestamp || event.timestamp || Date.now()),
    payload
  };
}

function buildPayload(event = {}) {
  const payload = { ...event };
  delete payload.type;
  delete payload.layer;
  delete payload.source;
  delete payload.timestamp;
  return payload;
}