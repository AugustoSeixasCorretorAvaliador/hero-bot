const WebSocket = require('ws')
const {
  MAX_MESSAGE_BYTES,
  createAck,
  normalizeEnvelopeObject,
  parseAndNormalizeMessage
} = require('./hero-protocol')

const DEFAULT_WS_HOST = '0.0.0.0'
const DEFAULT_WS_PORT = 8765
const DEFAULT_HEARTBEAT_INTERVAL_MS = 15000
const DEFAULT_HEARTBEAT_TIMEOUT_MS = 35000

function safeSend (client, message) {
  if (!client || client.readyState !== WebSocket.OPEN) return false
  try {
    client.send(JSON.stringify(message))
    return true
  } catch (_) {
    return false
  }
}

function readyStateName (readyState) {
  return ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][readyState] || `UNKNOWN(${readyState})`
}

function tokenAccepted (request, configuredToken) {
  if (!configuredToken) return true
  try {
    const requestUrl = new URL(request.url || '/', 'ws://hero-host.local')
    return requestUrl.searchParams.get('token') === configuredToken
  } catch (_) {
    return false
  }
}

function createHeroWebSocketServer (options = {}) {
  const host = options.host || DEFAULT_WS_HOST
  const port = Number.isInteger(options.port) ? options.port : DEFAULT_WS_PORT
  const token = options.token || ''
  const heartbeatIntervalMs = options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS
  const heartbeatTimeoutMs = options.heartbeatTimeoutMs ?? DEFAULT_HEARTBEAT_TIMEOUT_MS
  const logger = typeof options.logger === 'function' ? options.logger : console.log
  const onEvent = typeof options.onEvent === 'function' ? options.onEvent : () => {}

  const wss = new WebSocket.Server({ host, port, maxPayload: MAX_MESSAGE_BYTES })
  const clientMetadata = new Map()

  const ready = new Promise((resolve, reject) => {
    wss.once('listening', () => resolve(wss.address()))
    wss.once('error', reject)
  })
  wss.on('error', error => logger(`WebSocket server error: ${error.message}`))

  function sendNack (client, result) {
    safeSend(client, createAck(result.id, false, result.reason))
  }

  function describeClient (client) {
    const metadata = clientMetadata.get(client) || {}
    return {
      clientType: metadata.clientType || 'unknown',
      source: metadata.source || 'unknown',
      readyState: readyStateName(client.readyState),
      remoteIp: metadata.remoteIp || 'unknown',
      helloReceived: Boolean(metadata.helloReceived)
    }
  }

  function logClientRegistry () {
    for (const client of wss.clients) {
      const item = describeClient(client)
      logger([
        '[WS CLIENT]',
        `clientType: ${item.clientType}`,
        `source/deviceName: ${item.source}`,
        `readyState: ${item.readyState}`,
        `IP remoto: ${item.remoteIp}`,
        `CLIENT_HELLO recebido: ${item.helloReceived ? 'sim' : 'não'}`
      ].join('\n'))
    }
  }

  function logReceivedMessage (client, event = {}, fallback = {}) {
    const item = describeClient(client)
    logger([
      '[WS RX]',
      `id: ${event.id || fallback.id || ''}`,
      `type: ${event.type || fallback.type || 'INVALID'}`,
      `source: ${event.source || fallback.source || 'unknown'}`,
      `cliente remetente: ${item.clientType}/${item.source} @ ${item.remoteIp}`
    ].join('\n'))
  }

  function broadcastEvent (event, sender = null) {
    let eligibleClients = 0
    let sentClients = 0
    for (const client of wss.clients) {
      if (client === sender) continue
      if (client.readyState !== WebSocket.OPEN) continue
      eligibleClients += 1
      if (safeSend(client, event)) sentClients += 1
    }
    logger([
      '[WS BROADCAST]',
      `evento: ${event.type}`,
      `clientes conectados: ${wss.clients.size}`,
      `clientes elegíveis: ${eligibleClients}`,
      `clientes efetivamente enviados: ${sentClients}`
    ].join('\n'))
    logClientRegistry()
  }

  function handleControlMessage (client, event) {
    const metadata = clientMetadata.get(client)

    if (event.type === 'CLIENT_HELLO') {
      metadata.clientType = event.payload.clientType || 'unknown'
      metadata.source = event.source
      metadata.helloReceived = true
      metadata.capabilities = Array.isArray(event.payload.capabilities)
        ? event.payload.capabilities.slice(0, 16)
        : []
      logger(`WebSocket client identified: ${metadata.clientType} (${JSON.stringify(metadata.source)})`)
      logClientRegistry()
      safeSend(client, createAck(event.id, true))
      return
    }

    if (event.type === 'HEARTBEAT') {
      metadata.lastPongAt = Date.now()
      safeSend(client, {
        type: 'HEARTBEAT_ACK',
        id: event.id,
        source: 'hero-ws-server',
        timestamp: Date.now(),
        payload: { accepted: true }
      })
      return
    }

    // ACK/NACK and HEARTBEAT_ACK are terminal control messages. Never ACK an
    // ACK, which prevents protocol feedback loops.
    metadata.lastPongAt = Date.now()
  }

  function handleIncoming (client, data, isBinary = false) {
    const metadata = clientMetadata.get(client)
    if (metadata) metadata.lastPongAt = Date.now()

    if (isBinary) {
      logReceivedMessage(client, {}, { type: 'BINARY' })
      sendNack(client, { id: '', reason: 'binary_not_supported' })
      return
    }

    const result = parseAndNormalizeMessage(data)
    if (!result.ok) {
      logReceivedMessage(client, {}, { id: result.id, type: 'INVALID' })
      sendNack(client, result)
      return
    }

    logReceivedMessage(client, result.event)

    if (result.kind === 'control') {
      handleControlMessage(client, result.event)
      return
    }

    safeSend(client, createAck(result.event.id, true))
    onEvent(result.event)
    broadcastEvent(result.event, client)
  }

  function publishFromRenderer (message) {
    const result = normalizeEnvelopeObject(message)
    if (!result.ok || result.kind !== 'event') return result
    onEvent(result.event)
    broadcastEvent(result.event)
    return result
  }

  function sweepInactiveClients (now = Date.now()) {
    for (const client of wss.clients) {
      const metadata = clientMetadata.get(client)
      if (!metadata) continue
      if (now - metadata.lastPongAt > heartbeatTimeoutMs) {
        logger(`WebSocket client timed out: ${metadata.clientType} (${JSON.stringify(metadata.source)})`)
        client.terminate()
        continue
      }
      if (client.readyState === WebSocket.OPEN) client.ping()
    }
  }

  wss.on('connection', (client, request) => {
    if (!tokenAccepted(request, token)) {
      logger('WebSocket connection rejected: invalid token')
      client.close(1008, 'unauthorized')
      return
    }

    clientMetadata.set(client, {
      clientType: 'unknown',
      source: 'unknown',
      capabilities: [],
      remoteIp: request.socket?.remoteAddress || 'unknown',
      helloReceived: false,
      lastPongAt: Date.now()
    })
    logger('WebSocket client connected')
    logClientRegistry()

    client.on('pong', () => {
      const metadata = clientMetadata.get(client)
      if (metadata) metadata.lastPongAt = Date.now()
    })
    client.on('message', (data, isBinary) => handleIncoming(client, data, isBinary))
    client.on('error', error => logger(`WebSocket client error: ${error.message}`))
    client.on('close', () => {
      const metadata = clientMetadata.get(client)
      logger(`WebSocket client disconnected: ${metadata?.clientType || 'unknown'} (${JSON.stringify(metadata?.source || 'unknown')})`)
      clientMetadata.delete(client)
    })

    // Preserve the pre-Etapa-B connection notification for legacy clients.
    safeSend(client, { type: 'SIMULATOR_CONNECTED', source: 'simulator' })
  })

  const heartbeatTimer = heartbeatIntervalMs > 0
    ? setInterval(() => sweepInactiveClients(), heartbeatIntervalMs)
    : null
  if (heartbeatTimer?.unref) heartbeatTimer.unref()

  function close () {
    if (heartbeatTimer) clearInterval(heartbeatTimer)
    for (const client of wss.clients) client.terminate()
    return new Promise(resolve => wss.close(resolve))
  }

  return {
    wss,
    ready,
    publishFromRenderer,
    sweepInactiveClients,
    close,
    config: { host, port, heartbeatIntervalMs, heartbeatTimeoutMs, tokenEnabled: Boolean(token) }
  }
}

module.exports = {
  DEFAULT_HEARTBEAT_INTERVAL_MS,
  DEFAULT_HEARTBEAT_TIMEOUT_MS,
  DEFAULT_WS_HOST,
  DEFAULT_WS_PORT,
  createHeroWebSocketServer,
  tokenAccepted
}
