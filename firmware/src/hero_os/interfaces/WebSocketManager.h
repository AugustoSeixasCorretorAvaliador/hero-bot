#ifndef HEROBOT_WEBSOCKET_MANAGER_H
#define HEROBOT_WEBSOCKET_MANAGER_H

#include <functional>
#include <stdint.h>
#include <ArduinoJson.h>

namespace herobot {

using JsonDocumentPtr = ArduinoJson::DynamicJsonDocument*;

class WebSocketManager {
public:
    using MessageHandler = std::function<void(const char* payload)>;
    virtual ~WebSocketManager() {}
    virtual bool begin() = 0;
    virtual void loop() = 0;
    virtual void send(const char* msg) = 0;
    virtual void onMessage(MessageHandler h) = 0;
};

} // namespace herobot

#endif // HEROBOT_WEBSOCKET_MANAGER_H
