#include "hero_websocket_client.h"

#include <ArduinoJson.h>

#include "hero_app_config.h"
#include "hero_event_parser.h"

namespace herobot {

void HeroWebSocketClient::begin(const String& host, uint16_t port, const String& token,
                                const String& deviceName) {
  disconnect();
  deviceName_ = deviceName;
  state_ = HeroWebSocketState::Connecting;
  started_ = true;

  client_.onEvent([this](WStype_t type, uint8_t* payload, size_t length) {
    handleWebSocketEvent(type, payload, length);
  });
  client_.setReconnectInterval(HERO_WS_RECONNECT_INTERVAL_MS);
  client_.enableHeartbeat(HERO_WS_PING_INTERVAL_MS, HERO_WS_PONG_TIMEOUT_MS,
                          HERO_WS_DISCONNECT_AFTER_MISSED_PONGS);
  client_.begin(host.c_str(), port, tokenPath(token).c_str());

  Serial.printf("WebSocket: connecting to %s:%u\n", host.c_str(), port);
}

void HeroWebSocketClient::loop() {
  if (!started_) return;
  client_.loop();

  if (state_ == HeroWebSocketState::Connected &&
      millis() - lastApplicationHeartbeatAt_ >= HERO_WS_APP_HEARTBEAT_INTERVAL_MS) {
    sendApplicationHeartbeat();
  }
}

void HeroWebSocketClient::disconnect() {
  if (started_) client_.disconnect();
  started_ = false;
  state_ = HeroWebSocketState::Disconnected;
}

void HeroWebSocketClient::onEvent(EventHandler handler) {
  eventHandler_ = handler;
}

HeroWebSocketState HeroWebSocketClient::state() const {
  return state_;
}

const char* HeroWebSocketClient::stateName() const {
  switch (state_) {
    case HeroWebSocketState::Connecting: return "conectando";
    case HeroWebSocketState::Connected: return "conectado";
    case HeroWebSocketState::Disconnected: return "desconectado";
  }
  return "desconhecido";
}

void HeroWebSocketClient::handleWebSocketEvent(WStype_t type, uint8_t* payload,
                                                size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      state_ = HeroWebSocketState::Connected;
      lastApplicationHeartbeatAt_ = millis();
      Serial.println("WebSocket: connected");
      sendClientHello();
      break;
    case WStype_DISCONNECTED:
      state_ = started_ ? HeroWebSocketState::Connecting : HeroWebSocketState::Disconnected;
      Serial.println("WebSocket: disconnected");
      break;
    case WStype_TEXT:
      handleTextMessage(payload, length);
      break;
    case WStype_PING:
      Serial.println("[ESP32 WS CONTROL] PING recebido; evento visual preservado");
      break;
    case WStype_PONG:
      Serial.println("[ESP32 WS CONTROL] PONG recebido; evento visual preservado");
      break;
    default:
      break;
  }
}

void HeroWebSocketClient::handleTextMessage(const uint8_t* payload, size_t length) {
  Serial.println("[ESP32 WS RX]");
  Serial.printf("tamanho: %u\n", static_cast<unsigned>(length));
  Serial.print("conteúdo bruto: ");
  if (payload != nullptr && length > 0) Serial.write(payload, length);
  Serial.println();

  if (length == 0 || length > HERO_WS_MAX_MESSAGE_BYTES) {
    Serial.println("[ESP32 WS PARSER]");
    Serial.println("accepted: false");
    Serial.println("normalizedType: UNKNOWN");
    Serial.println("rejectionReason: invalid_message_size");
    sendNack("", "invalid_message_size");
    return;
  }

  JsonDocument controlDocument;
  const DeserializationError controlError = deserializeJson(
      controlDocument, payload, length, DeserializationOption::NestingLimit(6));
  if (controlError || !controlDocument.is<JsonObject>()) {
    const char* rejectionReason = controlError ? "invalid_json" : "message_must_be_object";
    Serial.println("[ESP32 WS PARSER]");
    Serial.println("accepted: false");
    Serial.println("normalizedType: UNKNOWN");
    Serial.printf("rejectionReason: %s\n", rejectionReason);
    sendNack("", controlError ? "invalid_json" : "message_must_be_object");
    return;
  }

  const String messageType = controlDocument["type"] | "";
  if (messageType == "ACK" || messageType == "NACK" ||
      messageType == "HEARTBEAT_ACK" || messageType == "SIMULATOR_CONNECTED" ||
      messageType == "CLIENT_HELLO") {
    Serial.println("[ESP32 WS PARSER]");
    Serial.println("accepted: ignored_control");
    Serial.printf("normalizedType: %s\n", messageType.c_str());
    Serial.println("rejectionReason: none");
    return;
  }
  if (messageType == "HEARTBEAT") {
    lastApplicationHeartbeatAt_ = millis();
    Serial.println("[ESP32 WS PARSER]");
    Serial.println("accepted: ignored_control");
    Serial.println("normalizedType: HEARTBEAT");
    Serial.println("rejectionReason: none");
    return;
  }

  HeroEvent event;
  String error;
  if (!HeroEventParser::parse(payload, length, event, error)) {
    Serial.println("[ESP32 WS PARSER]");
    Serial.println("accepted: false");
    Serial.println("normalizedType: UNKNOWN");
    Serial.printf("rejectionReason: %s\n", error.c_str());
    const String id = controlDocument["id"] | "";
    sendNack(id, error);
    return;
  }

  Serial.println("[ESP32 WS PARSER]");
  Serial.println("accepted: true");
  Serial.printf("normalizedType: %s\n", event.typeName.c_str());
  Serial.println("rejectionReason: none");
  sendEventAck(event);
  if (eventHandler_) eventHandler_(event);
}

void HeroWebSocketClient::sendClientHello() {
  JsonDocument document;
  document["id"] = deviceName_ + "-hello-" + String(millis());
  document["type"] = "CLIENT_HELLO";
  document["source"] = deviceName_;
  document["timestamp"] = millis();
  JsonObject payload = document["payload"].to<JsonObject>();
  payload["clientType"] = "esp32";
  payload["firmwareVersion"] = "0.1.0";
  JsonArray capabilities = payload["capabilities"].to<JsonArray>();
  capabilities.add("display");
  capabilities.add("ack");
  capabilities.add("heartbeat");

  String message;
  serializeJson(document, message);
  client_.sendTXT(message);
}

void HeroWebSocketClient::sendEventAck(const HeroEvent& event) {
  JsonDocument document;
  document["type"] = "ACK";
  document["id"] = event.id;
  document["source"] = deviceName_;
  document["timestamp"] = millis();
  document["payload"]["accepted"] = true;

  String message;
  serializeJson(document, message);
  client_.sendTXT(message);
}

void HeroWebSocketClient::sendNack(const String& id, const String& reason) {
  if (state_ != HeroWebSocketState::Connected) return;
  JsonDocument document;
  document["type"] = "NACK";
  document["id"] = id;
  document["source"] = deviceName_;
  document["timestamp"] = millis();
  document["payload"]["accepted"] = false;
  document["payload"]["reason"] = reason;

  String message;
  serializeJson(document, message);
  client_.sendTXT(message);
}

void HeroWebSocketClient::sendApplicationHeartbeat() {
  JsonDocument document;
  document["id"] = deviceName_ + "-heartbeat-" + String(millis());
  document["type"] = "HEARTBEAT";
  document["source"] = deviceName_;
  document["timestamp"] = millis();
  document["payload"]["uptime"] = millis();

  String message;
  serializeJson(document, message);
  client_.sendTXT(message);
  lastApplicationHeartbeatAt_ = millis();
}

String HeroWebSocketClient::tokenPath(const String& token) const {
  return token.isEmpty() ? String("/") : String("/?token=") + urlEncode(token);
}

String HeroWebSocketClient::urlEncode(const String& value) const {
  static const char hex[] = "0123456789ABCDEF";
  String encoded;
  encoded.reserve(value.length() * 3);
  for (size_t index = 0; index < value.length(); ++index) {
    const uint8_t character = static_cast<uint8_t>(value[index]);
    const bool safe = (character >= 'a' && character <= 'z') ||
                      (character >= 'A' && character <= 'Z') ||
                      (character >= '0' && character <= '9') ||
                      character == '-' || character == '_' || character == '.' || character == '~';
    if (safe) {
      encoded += static_cast<char>(character);
    } else {
      encoded += '%';
      encoded += hex[(character >> 4) & 0x0F];
      encoded += hex[character & 0x0F];
    }
  }
  return encoded;
}

}  // namespace herobot
