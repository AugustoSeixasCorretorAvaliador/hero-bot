const test = require('node:test')
const assert = require('node:assert/strict')
const {
  MAX_MESSAGE_BYTES,
  normalizeEnvelopeObject,
  parseAndNormalizeMessage
} = require('../hero-protocol')

test('accepts and canonicalizes a valid JSON event', () => {
  const result = parseAndNormalizeMessage(JSON.stringify({
    id: 'event-1',
    type: 'THINKING',
    source: 'test-client',
    timestamp: 123,
    payload: { reason: 'test' }
  }))

  assert.equal(result.ok, true)
  assert.equal(result.event.type, 'THINKING')
  assert.deepEqual(result.event.payload, { reason: 'test' })
})

test('rejects invalid JSON', () => {
  const result = parseAndNormalizeMessage('{invalid')
  assert.deepEqual(result, { ok: false, reason: 'invalid_json', id: '' })
})

test('generates an id when a legacy event has none', () => {
  const result = normalizeEnvelopeObject({ type: 'THINKING', source: 'legacy' }, 1000)
  assert.equal(result.ok, true)
  assert.match(result.event.id, /^[0-9a-f-]{36}$/)
  assert.equal(result.event.timestamp, 1000)
  assert.deepEqual(result.event.payload, {})
})

test('normalizes READY to HERO_READY', () => {
  const result = normalizeEnvelopeObject({ type: 'READY' })
  assert.equal(result.ok, true)
  assert.equal(result.event.type, 'HERO_READY')
})

test('normalizes HOT_LEAD to LEAD_HOT', () => {
  const result = normalizeEnvelopeObject({ type: 'HOT_LEAD' })
  assert.equal(result.ok, true)
  assert.equal(result.event.type, 'LEAD_HOT')
})

test('rejects an unknown event type', () => {
  const result = normalizeEnvelopeObject({ id: 'bad-1', type: 'EXECUTE_CODE' })
  assert.deepEqual(result, { ok: false, reason: 'invalid_event_type', id: 'bad-1' })
})

test('rejects a payload over the configured message limit', () => {
  const raw = JSON.stringify({ type: 'THINKING', payload: { value: 'x'.repeat(MAX_MESSAGE_BYTES) } })
  const result = parseAndNormalizeMessage(raw)
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'message_too_large')
})
