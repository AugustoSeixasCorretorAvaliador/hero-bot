#pragma once

#include <Arduino.h>

#include "hero_display.h"
#include "hero_event.h"

namespace herobot {

class HeroDisplayRenderer {
public:
  explicit HeroDisplayRenderer(HeroDisplay& display);

  void renderConnection(bool wifiConnected, const char* webSocketStatus,
                        const String& wifiIp, const String& webSocketIp);
  void renderEvent(const HeroEvent& event, bool wifiConnected,
                   const char* webSocketStatus, const String& wifiIp,
                   const String& webSocketIp);
  void setBatteryStatus(uint8_t percent, bool present);
  const String& lastEventName() const;

private:
  HeroDisplay& display_;
  String lastEventName_ = "nenhum";
  String eventHistory_[3];
  uint8_t batteryPercent_ = 0;
  bool batteryPresent_ = false;
};

}  // namespace herobot
