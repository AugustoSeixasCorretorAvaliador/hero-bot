#pragma once

#include <TFT_eSPI.h>

namespace herobot {

class HeroDisplay {
public:
  bool begin();
  void showStartupScreen();
  void showStatus(const char* title, const char* line1, const char* line2 = nullptr);
  void showBridgeStatus(const char* wifiStatus, const char* wifiIp,
                        const char* webSocketStatus, const char* webSocketIp,
                        const char* latestEvent, const char* previousEvent,
                        const char* oldestEvent);

private:
  TFT_eSPI tft_;

  void drawColorTestBar();
  void drawCentered(const char* text, int32_t y, uint8_t font, uint16_t color);
  void drawRobotIcon(int16_t x, int16_t y);
  void drawMoodFace(int16_t x, int16_t y, uint16_t accent);
  void drawWifiIcon(int16_t x, int16_t y, uint16_t color);
  void drawWebSocketIcon(int16_t x, int16_t y, uint16_t color);
  void drawEventIcon(int16_t x, int16_t y, const char* eventName, uint16_t color);
  void drawEventRow(int16_t y, const char* eventName, bool latest);
  void drawConnectionFooter(int16_t x, const char* label, const char* ip,
                            bool connected, bool wifiIcon);
  uint16_t eventColor(const char* eventName) const;
  const char* eventLabel(const char* eventName) const;
  const char* eventSubtitle(const char* eventName) const;
};

}  // namespace herobot
