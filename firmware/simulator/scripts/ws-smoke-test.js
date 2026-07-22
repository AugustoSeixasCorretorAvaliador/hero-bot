const WebSocket = require('ws')

const baseUrl = process.argv[2] || 'ws://127.0.0.1:8765'
const eventType = process.argv[3] || 'THINKING'
const token = process.env.HERO_WS_TOKEN || ''
const url = new URL(baseUrl)
if (token) url.searchParams.set('token', token)

const eventId = `smoke-${Date.now()}`
const client = new WebSocket(url)
const timeout = setTimeout(() => {
  console.error('Smoke test failed: ACK timeout')
  client.terminate()
  process.exitCode = 1
}, 5000)

client.on('open', () => {
  client.send(JSON.stringify({
    id: `hello-${Date.now()}`,
    type: 'CLIENT_HELLO',
    source: 'ws-smoke-test',
    timestamp: Date.now(),
    payload: {
      clientType: 'unknown',
      capabilities: ['ack']
    }
  }))

  client.send(JSON.stringify({
    id: eventId,
    type: eventType,
    source: 'ws-smoke-test',
    timestamp: Date.now(),
    payload: { reason: 'manual_smoke_test' }
  }))
})

client.on('message', data => {
  let message
  try {
    message = JSON.parse(data.toString())
  } catch (_) {
    return
  }

  if (message.type === 'ACK' && message.id === eventId) {
    clearTimeout(timeout)
    console.log(`Smoke test passed: ${eventType} ACK ${eventId}`)
    client.close()
  }
})

client.on('error', error => {
  clearTimeout(timeout)
  console.error(`Smoke test failed: ${error.message}`)
  process.exitCode = 1
})
