const test = require('node:test')
const assert = require('node:assert/strict')
const WebSocket = require('ws')
const { createHeroWebSocketServer } = require('../hero-ws-server')

function waitForOpen (client) {
  return new Promise((resolve, reject) => {
    client.once('open', resolve)
    client.once('error', reject)
  })
}

function nextJsonMessage (client) {
  return new Promise((resolve, reject) => {
    const onMessage = data => {
      cleanup()
      resolve(JSON.parse(data.toString()))
    }
    const onError = error => {
      cleanup()
      reject(error)
    }
    const cleanup = () => {
      client.off('message', onMessage)
      client.off('error', onError)
    }
    client.on('message', onMessage)
    client.on('error', onError)
  })
}

async function createTestContext (options = {}) {
  const rendered = []
  const logs = []
  const server = createHeroWebSocketServer({
    host: '127.0.0.1',
    port: 0,
    heartbeatIntervalMs: 0,
    logger: entry => logs.push(entry),
    onEvent: event => rendered.push(event),
    ...options
  })
  const address = await server.ready
  return { server, rendered, logs, url: `ws://127.0.0.1:${address.port}` }
}

async function connectClient (url) {
  const client = new WebSocket(url)
  const initialMessage = nextJsonMessage(client)
  await waitForOpen(client)
  await initialMessage // Legacy SIMULATOR_CONNECTED notification.
  return client
}

async function identifyClient (client, id, clientType, source) {
  const response = nextJsonMessage(client)
  client.send(JSON.stringify({
    id,
    type: 'CLIENT_HELLO',
    source,
    target: 'server',
    timestamp: Date.now(),
    payload: { clientType }
  }))
  const ack = await response
  assert.equal(ack.type, 'ACK')
  assert.equal(ack.id, id)
}

test('client A sends THINKING; ESP32 client B and renderer receive it; A receives only ACK', async t => {
  const { server, rendered, logs, url } = await createTestContext()
  t.after(() => server.close())

  const sender = await connectClient(url)
  const receiver = await connectClient(url)
  t.after(() => sender.terminate())
  t.after(() => receiver.terminate())
  await identifyClient(sender, 'hello-extension', 'chrome-extension', 'chrome-extension')
  await identifyClient(receiver, 'hello-esp32', 'esp32', 'hero-bot-001')

  const messagesSeenBySender = []
  sender.on('message', data => messagesSeenBySender.push(JSON.parse(data.toString())))
  const senderMessage = nextJsonMessage(sender)
  const receiverMessage = nextJsonMessage(receiver)
  sender.send(JSON.stringify({
    id: 'event-42',
    type: 'THINKING',
    source: 'chrome-extension',
    target: 'broadcast',
    timestamp: 1780000000000,
    payload: {}
  }))

  const ack = await senderMessage
  const broadcast = await receiverMessage

  assert.equal(ack.type, 'ACK')
  assert.equal(ack.id, 'event-42')
  assert.deepEqual(ack.payload, { accepted: true })
  assert.equal(broadcast.id, 'event-42')
  assert.equal(broadcast.type, 'THINKING')
  assert.equal(rendered.length, 1)
  assert.deepEqual(rendered[0], broadcast)
  await new Promise(resolve => setTimeout(resolve, 30))
  assert.equal(messagesSeenBySender.some(message => message.type === 'THINKING'), false)
  assert.equal(logs.some(entry => entry.includes('clientType: esp32') &&
    entry.includes('source/deviceName: hero-bot-001') &&
    entry.includes('readyState: OPEN') &&
    entry.includes('CLIENT_HELLO recebido: sim')), true)
  assert.equal(logs.some(entry => entry.includes('[WS BROADCAST]') &&
    entry.includes('evento: THINKING') &&
    entry.includes('clientes conectados: 2') &&
    entry.includes('clientes elegíveis: 1') &&
    entry.includes('clientes efetivamente enviados: 1')), true)
})

test('returns a structured NACK for an unknown type', async t => {
  const { server, url } = await createTestContext()
  t.after(() => server.close())
  const client = await connectClient(url)
  t.after(() => client.terminate())

  const response = nextJsonMessage(client)
  client.send(JSON.stringify({ id: 'bad-2', type: 'UNKNOWN_COMMAND' }))
  const nack = await response

  assert.equal(nack.type, 'NACK')
  assert.equal(nack.id, 'bad-2')
  assert.deepEqual(nack.payload, { accepted: false, reason: 'invalid_event_type' })
})

test('terminates a client whose heartbeat expired', async t => {
  const { server, url } = await createTestContext({ heartbeatTimeoutMs: 10 })
  t.after(() => server.close())
  const client = await connectClient(url)

  const closed = new Promise(resolve => client.once('close', resolve))
  server.sweepInactiveClients(Date.now() + 1000)
  await closed
  assert.equal(client.readyState, WebSocket.CLOSED)
})
