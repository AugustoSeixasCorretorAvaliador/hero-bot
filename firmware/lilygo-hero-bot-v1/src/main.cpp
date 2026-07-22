#include <Arduino.h>
#include <driver/gpio.h>
#include <esp_sleep.h>

#include "hero_app_config.h"
#include "hero_display.h"
#include "hero_display_renderer.h"
#include "hero_touch.h"
#include "hero_websocket_client.h"
#include "wifi_provisioning.h"

namespace {

herobot::HeroDisplay display;
herobot::HeroDisplayRenderer displayRenderer(display);
herobot::HeroTouch touch;
herobot::WifiProvisioning wifiProvisioning;
herobot::HeroWebSocketClient webSocketClient;
herobot::WifiProvisioningState lastWifiState = herobot::WifiProvisioningState::Starting;
herobot::HeroWebSocketState lastWebSocketState = herobot::HeroWebSocketState::Disconnected;
uint8_t lastWifiAttempt = 0;
bool webSocketStarted = false;
uint32_t lastVisualActivityAt = 0;
uint32_t lastBatteryRefreshAt = 0;
uint32_t lastDeepSleepAttemptAt = 0;

void releaseDeepSleepPinHolds() {
  gpio_deep_sleep_hold_dis();
  gpio_hold_dis(static_cast<gpio_num_t>(HERO_BOARD_POWER_PIN));
  gpio_hold_dis(static_cast<gpio_num_t>(HERO_DISPLAY_BACKLIGHT_PIN));
  gpio_hold_dis(static_cast<gpio_num_t>(HERO_TOUCH_RESET_PIN));
}

bool enterDeepSleep() {
  if (!touch.prepareForDeepSleep()) {
    Serial.println("Deep sleep: touch IRQ ocupado; tentativa adiada");
    return false;
  }

  display.prepareForDeepSleep();
  digitalWrite(HERO_BOARD_POWER_PIN, HIGH);
  digitalWrite(HERO_DISPLAY_BACKLIGHT_PIN, !HERO_DISPLAY_BACKLIGHT_ON);
  digitalWrite(HERO_TOUCH_RESET_PIN, HIGH);

  esp_sleep_enable_ext0_wakeup(
      static_cast<gpio_num_t>(HERO_TOUCH_INTERRUPT_PIN), 0);

  gpio_hold_en(static_cast<gpio_num_t>(HERO_BOARD_POWER_PIN));
  gpio_hold_en(static_cast<gpio_num_t>(HERO_DISPLAY_BACKLIGHT_PIN));
  gpio_hold_en(static_cast<gpio_num_t>(HERO_TOUCH_RESET_PIN));
  gpio_deep_sleep_hold_en();

  Serial.println("Deep sleep: entrando apos 2 horas sem evento ou toque");
  Serial.flush();
  delay(20);
  esp_deep_sleep_start();
  return true;
}

uint8_t batteryPercentFromMillivolts(uint32_t millivolts) {
  struct BatteryPoint {
    uint16_t millivolts;
    uint8_t percent;
  };
  constexpr BatteryPoint curve[] = {
      {3300, 0}, {3500, 5}, {3600, 10}, {3700, 25}, {3800, 45},
      {3900, 65}, {4000, 80}, {4100, 90}, {4200, 100},
  };

  if (millivolts <= curve[0].millivolts) return curve[0].percent;
  for (size_t index = 1; index < sizeof(curve) / sizeof(curve[0]); ++index) {
    if (millivolts <= curve[index].millivolts) {
      const BatteryPoint& lower = curve[index - 1];
      const BatteryPoint& upper = curve[index];
      return lower.percent +
             ((millivolts - lower.millivolts) * (upper.percent - lower.percent)) /
                 (upper.millivolts - lower.millivolts);
    }
  }
  return 100;
}

void refreshBatteryStatus(bool force = false) {
  const uint32_t now = millis();
  if (!force && now - lastBatteryRefreshAt < HERO_BATTERY_REFRESH_INTERVAL_MS) return;
  lastBatteryRefreshAt = now;

  uint32_t sampleSum = 0;
  for (uint8_t sample = 0; sample < HERO_BATTERY_SAMPLE_COUNT; ++sample) {
    sampleSum += analogReadMilliVolts(HERO_BATTERY_VOLTAGE_PIN);
    delay(2);
  }

  // The board connects VBAT to GPIO4 through a 1:2 voltage divider.
  const uint32_t batteryMillivolts =
      (sampleSum / HERO_BATTERY_SAMPLE_COUNT) * 2;
  const bool batteryPresent =
      batteryMillivolts >= 3000 && batteryMillivolts <= 4300;
  const uint8_t batteryPercent =
      batteryPresent ? batteryPercentFromMillivolts(batteryMillivolts) : 0;
  displayRenderer.setBatteryStatus(batteryPercent, batteryPresent);

  Serial.printf("Battery: %s, %lu mV, %u%%\n",
                batteryPresent ? "present" : "USB/no battery",
                static_cast<unsigned long>(batteryMillivolts), batteryPercent);

  if (wifiProvisioning.state() == herobot::WifiProvisioningState::Connected) {
    displayRenderer.renderConnection(true, webSocketClient.stateName(),
                                     wifiProvisioning.ipAddress(),
                                     wifiProvisioning.serverHost());
  }
}

void renderWifiState() {
  const herobot::WifiProvisioningState state = wifiProvisioning.state();
  const uint8_t attempt = wifiProvisioning.attempt();
  if (state == lastWifiState && attempt == lastWifiAttempt) {
    return;
  }
  lastWifiState = state;
  lastWifiAttempt = attempt;

  switch (state) {
    case herobot::WifiProvisioningState::Connecting: {
      const String attempt = "Tentativa " + String(wifiProvisioning.attempt()) + "/" +
                             String(HERO_WIFI_MAX_ATTEMPTS);
      display.showStatus("Wi-Fi", "Conectando...", attempt.c_str());
      break;
    }
    case herobot::WifiProvisioningState::Connected: {
      const String ip = wifiProvisioning.ipAddress();
      display.showStatus("Wi-Fi OK", ip.c_str(), "Conectando ao servidor");
      break;
    }
    case herobot::WifiProvisioningState::SetupPortal:
      display.showStatus("SETUP Wi-Fi", HERO_WIFI_SETUP_AP_SSID, "Abra 192.168.4.1");
      break;
    case herobot::WifiProvisioningState::Starting:
      break;
  }
}

void synchronizeWebSocket() {
  const bool wifiConnected =
      wifiProvisioning.state() == herobot::WifiProvisioningState::Connected;

  if (wifiConnected && !webSocketStarted) {
    webSocketClient.begin(wifiProvisioning.serverHost(), wifiProvisioning.serverPort(),
                          wifiProvisioning.sharedToken(), wifiProvisioning.deviceName());
    webSocketStarted = true;
  } else if (!wifiConnected && webSocketStarted) {
    webSocketClient.disconnect();
    webSocketStarted = false;
  }

  if (webSocketStarted) webSocketClient.loop();

  const herobot::HeroWebSocketState webSocketState = webSocketClient.state();
  if (wifiConnected && webSocketState != lastWebSocketState) {
    lastWebSocketState = webSocketState;
    displayRenderer.renderConnection(true, webSocketClient.stateName(),
                                     wifiProvisioning.ipAddress(),
                                     wifiProvisioning.serverHost());
  }
}

}  // namespace

void setup() {
  releaseDeepSleepPinHolds();
  Serial.begin(115200);
  delay(200);
  Serial.println("HERO.Bot LILYGO T-Display-S3 V1 starting");
  if (esp_sleep_get_wakeup_cause() == ESP_SLEEP_WAKEUP_EXT0) {
    Serial.println("Wake-up: toque no display");
  }

  const bool displayGeometryOk = display.begin();
  analogReadResolution(12);
  analogSetPinAttenuation(HERO_BATTERY_VOLTAGE_PIN, ADC_11db);
  refreshBatteryStatus(true);
  touch.begin();
  display.showStartupScreen();
  Serial.printf("Display ST7789: %s (rotation=%u)\n",
                displayGeometryOk ? "ready" : "unexpected geometry",
                HERO_DISPLAY_ROTATION);

  delay(1500);
  webSocketClient.onEvent([](const herobot::HeroEvent& event) {
    Serial.printf("HeroEvent: %s from %s\n", event.typeName.c_str(), event.source.c_str());
    display.wake();
    lastVisualActivityAt = millis();
    displayRenderer.renderEvent(event, true, webSocketClient.stateName(),
                                wifiProvisioning.ipAddress(),
                                wifiProvisioning.serverHost());
  });
  wifiProvisioning.begin();
  renderWifiState();
  lastVisualActivityAt = millis();
}

void loop() {
  wifiProvisioning.loop();
  renderWifiState();
  synchronizeWebSocket();
  refreshBatteryStatus();

  if (touch.consumeTouch()) {
    lastVisualActivityAt = millis();
    if (display.isSleeping()) {
      display.wake();
      Serial.println("Display: acordado por toque");
    }
  }

  if (!display.isSleeping() &&
      millis() - lastVisualActivityAt >= HERO_DISPLAY_IDLE_TIMEOUT_MS) {
    display.sleep();
    Serial.println("Display: sleep superficial por inatividade");
  }

  if (millis() - lastVisualActivityAt >= HERO_DEEP_SLEEP_IDLE_TIMEOUT_MS &&
      millis() - lastDeepSleepAttemptAt >= 1000) {
    lastDeepSleepAttemptAt = millis();
    enterDeepSleep();
  }
  delay(5);
}
