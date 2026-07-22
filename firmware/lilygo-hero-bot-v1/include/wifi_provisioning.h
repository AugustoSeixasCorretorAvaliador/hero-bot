#pragma once

#include <DNSServer.h>
#include <Preferences.h>
#include <WebServer.h>
#include <WiFi.h>

namespace herobot {

enum class WifiProvisioningState : uint8_t {
  Starting,
  Connecting,
  Connected,
  SetupPortal,
};

class WifiProvisioning {
public:
  void begin();
  void loop();

  WifiProvisioningState state() const;
  uint8_t attempt() const;
  String ipAddress() const;
  const String& serverHost() const;
  uint16_t serverPort() const;
  const String& sharedToken() const;
  const String& deviceName() const;

private:
  Preferences preferences_;
  DNSServer dnsServer_;
  WebServer webServer_{80};

  WifiProvisioningState state_ = WifiProvisioningState::Starting;
  String ssid_;
  String password_;
  String serverHost_;
  uint16_t serverPort_ = 0;
  String sharedToken_;
  String deviceName_;
  uint8_t attempt_ = 0;
  uint32_t attemptStartedAt_ = 0;
  uint32_t retryAt_ = 0;
  uint32_t portalConnectAt_ = 0;
  bool routesConfigured_ = false;
  bool serverStarted_ = false;

  void configurePortalRoutes();
  void startConnection(bool resetAttempts);
  void startConnectionAttempt();
  void startSetupPortal();
  void handlePortal();
  void handleConfigure();
  void schedulePortalConnection();
  String htmlEscape(const String& value) const;
};

}  // namespace herobot
