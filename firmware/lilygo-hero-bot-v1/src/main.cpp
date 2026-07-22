#include <Arduino.h>

#include "hero_app_config.h"
#include "hero_display.h"
#include "hero_display_renderer.h"
#include "hero_websocket_client.h"
#include "wifi_provisioning.h"

namespace {

herobot::HeroDisplay display;
herobot::HeroDisplayRenderer displayRenderer(display);
herobot::WifiProvisioning wifiProvisioning;
herobot::HeroWebSocketClient webSocketClient;
herobot::WifiProvisioningState lastWifiState = herobot::WifiProvisioningState::Starting;
herobot::HeroWebSocketState lastWebSocketState = herobot::HeroWebSocketState::Disconnected;
uint8_t lastWifiAttempt = 0;
bool webSocketStarted = false;

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
  Serial.begin(115200);
  delay(200);
  Serial.println("HERO.Bot LILYGO T-Display-S3 V1 starting");

  const bool displayGeometryOk = display.begin();
  display.showStartupScreen();
  Serial.printf("Display ST7789: %s (rotation=%u)\n",
                displayGeometryOk ? "ready" : "unexpected geometry",
                HERO_DISPLAY_ROTATION);

  delay(1500);
  webSocketClient.onEvent([](const herobot::HeroEvent& event) {
    Serial.printf("HeroEvent: %s from %s\n", event.typeName.c_str(), event.source.c_str());
    displayRenderer.renderEvent(event, true, webSocketClient.stateName(),
                                wifiProvisioning.ipAddress(),
                                wifiProvisioning.serverHost());
  });
  wifiProvisioning.begin();
  renderWifiState();
}

void loop() {
  wifiProvisioning.loop();
  renderWifiState();
  synchronizeWebSocket();
  delay(5);
}
