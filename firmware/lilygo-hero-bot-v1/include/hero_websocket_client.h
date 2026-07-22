#pragma once

#include <Arduino.h>
#include <WebSocketsClient.h>

#include <functional>

#include "hero_event.h"

namespace herobot {

enum class HeroWebSocketState : uint8_t {
  Disconnected,
  Connecting,
  Connected,
};

class HeroWebSocketClient {
public:
  using EventHandler = std::function<void(const HeroEvent&)>;

  void begin(const String& host, uint16_t port, const String& token,
             const String& deviceName);
  void loop();
  void disconnect();
  void onEvent(EventHandler handler);

  HeroWebSocketState state() const;
  const char* stateName() const;

private:
  WebSocketsClient client_;
  EventHandler eventHandler_;
  HeroWebSocketState state_ = HeroWebSocketState::Disconnected;
  String deviceName_;
  uint32_t lastApplicationHeartbeatAt_ = 0;
  bool started_ = false;

  void handleWebSocketEvent(WStype_t type, uint8_t* payload, size_t length);
  void handleTextMessage(const uint8_t* payload, size_t length);
  void sendClientHello();
  void sendEventAck(const HeroEvent& event);
  void sendNack(const String& id, const String& reason);
  void sendApplicationHeartbeat();
  String tokenPath(const String& token) const;
  String urlEncode(const String& value) const;
};

}  // namespace herobot
