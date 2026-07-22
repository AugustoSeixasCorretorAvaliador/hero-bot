const { randomUUID } = require('crypto')

const MAX_MESSAGE_BYTES = 4096
const MAX_PAYLOAD_BYTES = 3072
const MAX_PAYLOAD_DEPTH = 6
const MAX_ID_LENGTH = 128
const MAX_TYPE_LENGTH = 32
const MAX_SOURCE_LENGTH = 64
const MAX_TARGET_LENGTH = 64

const EVENT_ALIASES = Object.freeze({
  READY: 'HERO_READY',
  HOT_LEAD: 'LEAD_HOT'
})

const ACCEPTED_EVENT_TYPES = new Set([
  'BOOT',
  'READY',
  'HERO_READY',
  'HERO_OPEN',
  'IDLE',
  'THINKING',
  'WRITING',
  'SUCCESS',
  'ERROR',
  'HOT_LEAD',
  'LEAD_HOT',
  'SLEEP',
  'OFFLINE'
])

const CONTROL_TYPES = new Set([
  'CLIENT_HELLO',
  'ACK',
  'NACK',
  'HEARTBEAT',
  'HEARTBEAT_ACK'
])

const CLIENT_TYPES = new Set(['chrome-extension', 'simulator', 'esp32', 'unknown'])

function isPlainObject (value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function payloadDepth (value, depth = 0) {
  if (value === null || typeof value !== 'object') return depth
  if (depth > MAX_PAYLOAD_DEPTH) return depth

  const values = Array.isArray(value) ? value : Object.values(value)
  let maximum = depth
  for (const item of values) {
    maximum = Math.max(maximum, payloadDepth(item, depth + 1))
  }
  return maximum
}

function normalizePayload (payload) {
  if (payload === undefined || payload === null) return {}
  if (isPlainObject(payload)) return payload
  return { value: payload }
}

function normalizeEventType (type) {
  return EVENT_ALIASES[type] || type
}

function errorResult (reason, id = '') {
  return { ok: false, reason, id: typeof id === 'string' ? id : '' }
}

function normalizeEnvelopeObject (message, now = Date.now()) {
  if (!isPlainObject(message)) return errorResult('message_must_be_object')

  const rawType = typeof message.type === 'string' ? message.type.trim() : ''
  const candidateId = typeof message.id === 'string' ? message.id.trim() : ''

  if (!rawType) return errorResult('missing_event_type', candidateId)
  if (rawType.length > MAX_TYPE_LENGTH) return errorResult('event_type_too_long', candidateId)

  if (CONTROL_TYPES.has(rawType)) {
    return normalizeControlMessage(message, rawType, candidateId, now)
  }

  if (!ACCEPTED_EVENT_TYPES.has(rawType)) {
    return errorResult('invalid_event_type', candidateId)
  }

  const id = candidateId || randomUUID()
  const source = typeof message.source === 'string' && message.source.trim()
    ? message.source.trim()
    : 'unknown'
  const target = typeof message.target === 'string' && message.target.trim()
    ? message.target.trim()
    : 'broadcast'

  if (id.length > MAX_ID_LENGTH) return errorResult('id_too_long', candidateId)
  if (source.length > MAX_SOURCE_LENGTH) return errorResult('source_too_long', candidateId)
  if (target.length > MAX_TARGET_LENGTH) return errorResult('target_too_long', candidateId)

  const payload = normalizePayload(message.payload)
  if (payloadDepth(payload) > MAX_PAYLOAD_DEPTH) {
    return errorResult('payload_too_deep', id)
  }
  if (Buffer.byteLength(JSON.stringify(payload), 'utf8') > MAX_PAYLOAD_BYTES) {
    return errorResult('payload_too_large', id)
  }

  const suppliedTimestamp = Number(message.timestamp)
  const timestamp = Number.isFinite(suppliedTimestamp) && suppliedTimestamp > 0
    ? suppliedTimestamp
    : now

  return {
    ok: true,
    kind: 'event',
    event: {
      id,
      type: normalizeEventType(rawType),
      source,
      target,
      timestamp,
      payload
    }
  }
}

function normalizeControlMessage (message, type, candidateId, now) {
  const id = candidateId || randomUUID()
  const source = typeof message.source === 'string' && message.source.trim()
    ? message.source.trim()
    : 'unknown'
  const payload = normalizePayload(message.payload)

  if (id.length > MAX_ID_LENGTH) return errorResult('id_too_long', candidateId)
  if (source.length > MAX_SOURCE_LENGTH) return errorResult('source_too_long', candidateId)
  if (payloadDepth(payload) > MAX_PAYLOAD_DEPTH) return errorResult('payload_too_deep', id)
  if (Buffer.byteLength(JSON.stringify(payload), 'utf8') > MAX_PAYLOAD_BYTES) {
    return errorResult('payload_too_large', id)
  }

  if (type === 'CLIENT_HELLO') {
    const requestedClientType = typeof payload.clientType === 'string'
      ? payload.clientType
      : 'unknown'
    payload.clientType = CLIENT_TYPES.has(requestedClientType) ? requestedClientType : 'unknown'
  }

  return {
    ok: true,
    kind: 'control',
    event: {
      id,
      type,
      source,
      target: 'hero-ws-server',
      timestamp: Number(message.timestamp) > 0 ? Number(message.timestamp) : now,
      payload
    }
  }
}

function parseAndNormalizeMessage (raw, now = Date.now()) {
  const bytes = Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw), 'utf8')
  if (bytes.length > MAX_MESSAGE_BYTES) return errorResult('message_too_large')

  let parsed
  try {
    parsed = JSON.parse(bytes.toString('utf8'))
  } catch (_) {
    return errorResult('invalid_json')
  }

  return normalizeEnvelopeObject(parsed, now)
}

function createAck (id, accepted = true, reason = '', now = Date.now()) {
  return {
    type: accepted ? 'ACK' : 'NACK',
    id: typeof id === 'string' ? id : '',
    source: 'hero-ws-server',
    timestamp: now,
    payload: accepted ? { accepted: true } : { accepted: false, reason }
  }
}

module.exports = {
  ACCEPTED_EVENT_TYPES,
  CLIENT_TYPES,
  EVENT_ALIASES,
  MAX_MESSAGE_BYTES,
  MAX_PAYLOAD_BYTES,
  MAX_PAYLOAD_DEPTH,
  createAck,
  normalizeEnvelopeObject,
  normalizeEventType,
  parseAndNormalizeMessage,
  payloadDepth
}
