#include "hero_display_renderer.h"

namespace herobot {

HeroDisplayRenderer::HeroDisplayRenderer(HeroDisplay& display) : display_(display) {}

void HeroDisplayRenderer::renderConnection(bool wifiConnected,
                                           const char* webSocketStatus,
                                           const String& wifiIp,
                                           const String& webSocketIp) {
  display_.showBridgeStatus(wifiConnected ? "conectado" : "desconectado",
                            wifiIp.c_str(), webSocketStatus, webSocketIp.c_str(),
                            eventHistory_[0].c_str(), eventHistory_[1].c_str(),
                            eventHistory_[2].c_str(), batteryPercent_,
                            batteryPresent_);
}

void HeroDisplayRenderer::renderEvent(const HeroEvent& event, bool wifiConnected,
                                      const char* webSocketStatus,
                                      const String& wifiIp,
                                      const String& webSocketIp) {
  eventHistory_[2] = eventHistory_[1];
  eventHistory_[1] = eventHistory_[0];
  eventHistory_[0] = event.typeName;
  lastEventName_ = eventHistory_[0];
  renderConnection(wifiConnected, webSocketStatus, wifiIp, webSocketIp);
}

void HeroDisplayRenderer::setBatteryStatus(uint8_t percent, bool present) {
  batteryPercent_ = percent;
  batteryPresent_ = present;
}

const String& HeroDisplayRenderer::lastEventName() const {
  return lastEventName_;
}

}  // namespace herobot
