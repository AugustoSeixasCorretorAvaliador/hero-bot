#include "hero_display.h"

#include <Arduino.h>
#include <cstring>

#include "hero_tdisplay_s3_config.h"

namespace herobot {

namespace {
constexpr uint16_t HERO_BG = 0x0008;
constexpr uint16_t HERO_CARD = 0x0841;
constexpr uint16_t HERO_BORDER = 0x1AAF;
constexpr uint16_t HERO_MUTED = 0x7BEF;
constexpr uint16_t HERO_ORANGE = 0xFD20;
constexpr uint16_t HERO_PURPLE = 0xA81F;
}  // namespace

bool HeroDisplay::begin() {
  pinMode(HERO_BOARD_POWER_PIN, OUTPUT);
  digitalWrite(HERO_BOARD_POWER_PIN, HIGH);

  pinMode(HERO_DISPLAY_BACKLIGHT_PIN, OUTPUT);
  digitalWrite(HERO_DISPLAY_BACKLIGHT_PIN, !HERO_DISPLAY_BACKLIGHT_ON);

  tft_.begin();
  tft_.setRotation(HERO_DISPLAY_ROTATION);
  tft_.setSwapBytes(true);
  tft_.fillScreen(TFT_BLACK);

  digitalWrite(HERO_DISPLAY_BACKLIGHT_PIN, HERO_DISPLAY_BACKLIGHT_ON);

  return tft_.width() == HERO_DISPLAY_LOGICAL_WIDTH &&
         tft_.height() == HERO_DISPLAY_LOGICAL_HEIGHT;
}

void HeroDisplay::sleep() {
  if (sleeping_) return;
  digitalWrite(HERO_DISPLAY_BACKLIGHT_PIN, !HERO_DISPLAY_BACKLIGHT_ON);
  sleeping_ = true;
}

void HeroDisplay::wake() {
  if (!sleeping_) return;
  digitalWrite(HERO_DISPLAY_BACKLIGHT_PIN, HERO_DISPLAY_BACKLIGHT_ON);
  sleeping_ = false;
}

void HeroDisplay::prepareForDeepSleep() {
  sleep();
  tft_.writecommand(0x10);  // ST7789 sleep-in command.
}

bool HeroDisplay::isSleeping() const {
  return sleeping_;
}

void HeroDisplay::drawColorTestBar() {
  constexpr uint16_t colorCount = 4;
  const uint16_t colors[colorCount] = {TFT_RED, TFT_GREEN, TFT_BLUE, TFT_YELLOW};
  const int16_t segmentWidth = tft_.width() / colorCount;

  for (uint16_t index = 0; index < colorCount; ++index) {
    const int16_t x = index * segmentWidth;
    const int16_t width = index == colorCount - 1 ? tft_.width() - x : segmentWidth;
    tft_.fillRect(x, 0, width, 14, colors[index]);
  }
}

void HeroDisplay::drawCentered(const char* text, int32_t y, uint8_t font, uint16_t color) {
  tft_.setTextColor(color, TFT_BLACK);
  tft_.setTextDatum(MC_DATUM);
  tft_.drawString(text, tft_.width() / 2, y, font);
}

void HeroDisplay::showStartupScreen() {
  tft_.fillScreen(TFT_BLACK);
  drawColorTestBar();

  drawCentered("HERO.Bot", 46, 4, TFT_CYAN);
  drawCentered("Firmware V1", 82, 2, TFT_WHITE);
  drawCentered("Display ST7789 OK", 107, 2, TFT_GREEN);

  tft_.fillRect(0, 142, tft_.width(), 28, TFT_NAVY);
  tft_.setTextColor(TFT_WHITE, TFT_NAVY);
  tft_.setTextDatum(MC_DATUM);
  tft_.drawString("USB-C + BOTOES", (tft_.width() / 2) - 8, 156, 2);
  tft_.fillTriangle(tft_.width() - 18, 149, tft_.width() - 18, 163,
                    tft_.width() - 5, 156, TFT_YELLOW);
}

void HeroDisplay::showStatus(const char* title, const char* line1, const char* line2) {
  tft_.fillScreen(TFT_BLACK);
  drawColorTestBar();
  drawCentered(title, 48, 4, TFT_CYAN);
  drawCentered(line1, 91, 2, TFT_WHITE);
  if (line2 != nullptr && line2[0] != '\0') {
    drawCentered(line2, 118, 2, TFT_GREEN);
  }

  tft_.fillRect(0, 148, tft_.width(), 22, TFT_NAVY);
  tft_.setTextColor(TFT_YELLOW, TFT_NAVY);
  tft_.setTextDatum(MC_DATUM);
  tft_.drawString("LADO DIREITO  >", tft_.width() / 2, 159, 2);
}

void HeroDisplay::drawRobotIcon(int16_t x, int16_t y) {
  tft_.drawLine(x, y - 13, x, y - 9, TFT_LIGHTGREY);
  tft_.fillCircle(x, y - 14, 2, TFT_CYAN);
  tft_.fillRoundRect(x - 13, y - 9, 26, 19, 5, TFT_DARKGREY);
  tft_.drawRoundRect(x - 13, y - 9, 26, 19, 5, TFT_LIGHTGREY);
  tft_.fillRoundRect(x - 9, y - 5, 18, 10, 4, HERO_BG);
  tft_.fillCircle(x - 5, y, 2, TFT_CYAN);
  tft_.fillCircle(x + 5, y, 2, TFT_CYAN);
  tft_.drawFastHLine(x - 4, y + 7, 8, TFT_CYAN);
}

void HeroDisplay::drawMoodFace(int16_t x, int16_t y, uint16_t accent) {
  tft_.fillCircle(x, y, 13, TFT_YELLOW);
  tft_.drawCircle(x, y, 13, accent);
  tft_.fillCircle(x - 4, y - 3, 2, HERO_BG);
  tft_.fillCircle(x + 4, y - 3, 2, HERO_BG);
  tft_.drawLine(x - 5, y + 4, x - 2, y + 7, HERO_BG);
  tft_.drawFastHLine(x - 2, y + 7, 4, HERO_BG);
  tft_.drawLine(x + 2, y + 7, x + 5, y + 4, HERO_BG);
}

void HeroDisplay::drawWifiIcon(int16_t x, int16_t y, uint16_t color) {
  tft_.fillCircle(x, y + 6, 2, color);
  tft_.drawLine(x - 5, y + 2, x, y - 1, color);
  tft_.drawLine(x, y - 1, x + 5, y + 2, color);
  tft_.drawLine(x - 8, y - 2, x, y - 6, color);
  tft_.drawLine(x, y - 6, x + 8, y - 2, color);
}

void HeroDisplay::drawWebSocketIcon(int16_t x, int16_t y, uint16_t color) {
  tft_.drawCircle(x, y, 9, color);
  tft_.drawFastHLine(x - 8, y, 17, color);
  tft_.drawFastVLine(x, y - 8, 17, color);
  tft_.drawLine(x - 5, y - 7, x - 7, y + 5, color);
  tft_.drawLine(x + 5, y - 7, x + 7, y + 5, color);
}

void HeroDisplay::drawEventIcon(int16_t x, int16_t y, const char* eventName,
                                uint16_t color) {
  if (std::strcmp(eventName, "THINKING") == 0) {
    tft_.fillCircle(x - 4, y - 2, 4, color);
    tft_.fillCircle(x + 2, y - 4, 4, color);
    tft_.fillCircle(x + 5, y + 2, 4, color);
    tft_.fillCircle(x - 2, y + 4, 4, color);
    tft_.drawFastVLine(x, y - 6, 12, HERO_BG);
    return;
  }
  if (std::strcmp(eventName, "WRITING") == 0) {
    tft_.drawLine(x - 7, y + 6, x + 6, y - 7, color);
    tft_.drawLine(x - 5, y + 8, x + 8, y - 5, color);
    tft_.fillTriangle(x - 8, y + 9, x - 6, y + 3, x - 2, y + 7, TFT_WHITE);
    return;
  }
  if (std::strcmp(eventName, "SUCCESS") == 0) {
    tft_.drawLine(x - 8, y, x - 2, y + 6, color);
    tft_.drawLine(x - 2, y + 6, x + 9, y - 7, color);
    tft_.drawLine(x - 7, y, x - 2, y + 5, color);
    return;
  }
  if (std::strcmp(eventName, "ERROR") == 0) {
    tft_.drawLine(x - 7, y - 7, x + 7, y + 7, color);
    tft_.drawLine(x + 7, y - 7, x - 7, y + 7, color);
    return;
  }
  if (std::strcmp(eventName, "OFFLINE") == 0) {
    drawWebSocketIcon(x, y, color);
    tft_.drawLine(x - 8, y - 8, x + 8, y + 8, TFT_RED);
    return;
  }
  if (std::strcmp(eventName, "SLEEP") == 0) {
    tft_.setTextDatum(MC_DATUM);
    tft_.setTextColor(color, HERO_BG);
    tft_.drawString("Zz", x, y, 2);
    return;
  }
  if (std::strcmp(eventName, "LEAD_HOT") == 0) {
    tft_.fillTriangle(x, y - 10, x - 8, y + 7, x + 8, y + 7, color);
    tft_.fillCircle(x, y + 4, 4, TFT_YELLOW);
    return;
  }
  tft_.fillTriangle(x + 1, y - 10, x - 7, y + 2, x, y + 1, color);
  tft_.fillTriangle(x, y - 1, x + 7, y - 2, x - 2, y + 10, color);
}

void HeroDisplay::drawEventRow(int16_t y, const char* eventName, bool latest) {
  const bool hasEvent = eventName != nullptr && eventName[0] != '\0';
  const char* visibleName = hasEvent ? eventLabel(eventName) : "AGUARDANDO...";
  const uint16_t accent = hasEvent ? eventColor(eventName) : HERO_MUTED;

  tft_.fillRoundRect(8, y, 304, 27, 6, HERO_CARD);
  tft_.drawRoundRect(8, y, 304, 27, 6, latest && hasEvent ? accent : HERO_BORDER);
  tft_.fillCircle(26, y + 13, 10, HERO_BG);
  if (hasEvent) drawEventIcon(26, y + 13, eventName, accent);
  else tft_.fillCircle(26, y + 13, 2, HERO_MUTED);

  tft_.setTextDatum(ML_DATUM);
  tft_.setTextColor(accent, HERO_CARD);
  tft_.drawString(visibleName, 45, y + 14, 2);
  if (latest && hasEvent) {
    tft_.setTextDatum(MR_DATUM);
    tft_.setTextColor(TFT_WHITE, HERO_CARD);
    tft_.drawString("AGORA", 300, y + 14, 1);
  }
}

void HeroDisplay::drawConnectionFooter(int16_t x, const char* label, const char* ip,
                                       bool connected, bool wifiIcon) {
  const uint16_t accent = connected ? (wifiIcon ? TFT_GREEN : TFT_CYAN) : HERO_ORANGE;
  tft_.fillRoundRect(x, 133, 148, 33, 6, HERO_CARD);
  tft_.drawRoundRect(x, 133, 148, 33, 6, accent);
  if (wifiIcon) drawWifiIcon(x + 16, 149, accent);
  else drawWebSocketIcon(x + 16, 149, accent);

  tft_.setTextDatum(TL_DATUM);
  tft_.setTextColor(accent, HERO_CARD);
  tft_.drawString(label, x + 31, 137, 1);
  tft_.drawString(ip, x + 31, 149, 2);

  tft_.fillCircle(x + 137, 149, 7, connected ? accent : TFT_DARKGREY);
  if (connected) {
    tft_.drawLine(x + 134, 149, x + 136, 152, TFT_WHITE);
    tft_.drawLine(x + 136, 152, x + 141, 146, TFT_WHITE);
  } else {
    tft_.drawFastHLine(x + 134, 149, 7, HERO_MUTED);
  }
}

void HeroDisplay::drawBatteryIndicator(uint8_t percent, bool batteryPresent) {
  const int16_t batteryX = 129;
  const int16_t batteryY = 10;
  const uint16_t color = !batteryPresent ? HERO_MUTED
                           : percent <= 15 ? TFT_RED
                           : percent <= 35 ? TFT_YELLOW
                                           : TFT_GREEN;

  tft_.drawRoundRect(batteryX, batteryY, 25, 13, 2, color);
  tft_.fillRect(batteryX + 25, batteryY + 4, 3, 5, color);
  if (batteryPresent) {
    const int16_t fillWidth = (21 * percent) / 100;
    if (fillWidth > 0) {
      tft_.fillRect(batteryX + 2, batteryY + 2, fillWidth, 9, color);
    }
  }

  char label[6];
  if (batteryPresent) snprintf(label, sizeof(label), "%u%%", percent);
  else snprintf(label, sizeof(label), "USB");
  tft_.setTextDatum(ML_DATUM);
  tft_.setTextColor(color, HERO_BG);
  tft_.drawString(label, batteryX + 34, batteryY + 7, 2);
}

uint16_t HeroDisplay::eventColor(const char* eventName) const {
  if (std::strcmp(eventName, "ERROR") == 0) return TFT_RED;
  if (std::strcmp(eventName, "SUCCESS") == 0 ||
      std::strcmp(eventName, "HERO_READY") == 0) return TFT_GREEN;
  if (std::strcmp(eventName, "THINKING") == 0) return TFT_YELLOW;
  if (std::strcmp(eventName, "WRITING") == 0) return TFT_CYAN;
  if (std::strcmp(eventName, "LEAD_HOT") == 0) return HERO_ORANGE;
  if (std::strcmp(eventName, "SLEEP") == 0) return HERO_PURPLE;
  if (std::strcmp(eventName, "OFFLINE") == 0) return HERO_MUTED;
  return TFT_CYAN;
}

const char* HeroDisplay::eventLabel(const char* eventName) const {
  if (std::strcmp(eventName, "BOOT") == 0) return "INICIANDO";
  if (std::strcmp(eventName, "HERO_READY") == 0) return "PRONTO";
  if (std::strcmp(eventName, "HERO_OPEN") == 0) return "HERO ATIVO";
  if (std::strcmp(eventName, "IDLE") == 0) return "AGUARDANDO";
  if (std::strcmp(eventName, "THINKING") == 0) return "PENSANDO";
  if (std::strcmp(eventName, "WRITING") == 0) return "ESCREVENDO";
  if (std::strcmp(eventName, "SUCCESS") == 0) return "CONCLUIDO";
  if (std::strcmp(eventName, "ERROR") == 0) return "ERRO";
  if (std::strcmp(eventName, "LEAD_HOT") == 0) return "LEAD QUENTE";
  if (std::strcmp(eventName, "SLEEP") == 0) return "DESCANSANDO";
  if (std::strcmp(eventName, "OFFLINE") == 0) return "SEM CONEXAO";
  return eventName;
}

const char* HeroDisplay::eventSubtitle(const char* eventName) const {
  if (std::strcmp(eventName, "THINKING") == 0) return "Processando...";
  if (std::strcmp(eventName, "WRITING") == 0) return "Escrevendo...";
  if (std::strcmp(eventName, "SUCCESS") == 0) return "Missao concluida";
  if (std::strcmp(eventName, "ERROR") == 0) return "Preciso de ajuda";
  if (std::strcmp(eventName, "OFFLINE") == 0) return "Modo offline";
  if (std::strcmp(eventName, "SLEEP") == 0) return "Descansando";
  return "Pronto para ajudar";
}

void HeroDisplay::showBridgeStatus(const char* wifiStatus, const char* wifiIp,
                                   const char* webSocketStatus, const char* webSocketIp,
                                   const char* latestEvent, const char* previousEvent,
                                   const char* oldestEvent, uint8_t batteryPercent,
                                   bool batteryPresent) {
  const bool wifiHealthy = std::strcmp(wifiStatus, "conectado") == 0;
  const bool webSocketHealthy = std::strcmp(webSocketStatus, "conectado") == 0;
  const bool hasLatestEvent = latestEvent != nullptr && latestEvent[0] != '\0';
  const uint16_t currentEventColor = hasLatestEvent ? eventColor(latestEvent) : TFT_CYAN;

  tft_.fillScreen(HERO_BG);
  tft_.fillRect(0, 0, 80, 4, TFT_RED);
  tft_.fillRect(80, 0, 80, 4, TFT_GREEN);
  tft_.fillRect(160, 0, 80, 4, TFT_BLUE);
  tft_.fillRect(240, 0, 80, 4, TFT_YELLOW);

  drawRobotIcon(27, 20);
  drawMoodFace(292, 19, currentEventColor);
  tft_.setTextDatum(TL_DATUM);
  tft_.setTextColor(TFT_WHITE, HERO_BG);
  tft_.drawString("HERO.Bot", 48, 7, 2);
  tft_.setTextColor(currentEventColor, HERO_BG);
  tft_.drawString(eventSubtitle(hasLatestEvent ? latestEvent : ""), 48, 25, 1);
  drawBatteryIndicator(batteryPercent, batteryPresent);

  drawEventRow(38, latestEvent, true);
  drawEventRow(68, previousEvent, false);
  drawEventRow(98, oldestEvent, false);

  drawConnectionFooter(8, "Wi-Fi =", wifiIp, wifiHealthy, true);
  drawConnectionFooter(164, "WS =", webSocketIp, webSocketHealthy, false);
}

}  // namespace herobot
