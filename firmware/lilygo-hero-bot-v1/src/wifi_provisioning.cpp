#include "wifi_provisioning.h"

#include <Arduino.h>

#include "hero_app_config.h"

namespace herobot {

void WifiProvisioning::begin() {
  preferences_.begin(HERO_WIFI_NVS_NAMESPACE, false);
  ssid_ = preferences_.getString("ssid", "");
  password_ = preferences_.getString("password", "");
  serverHost_ = preferences_.getString("ws_host", HERO_WS_DEFAULT_HOST);
  serverPort_ = preferences_.getUShort("ws_port", HERO_WS_DEFAULT_PORT);
  sharedToken_ = preferences_.getString("ws_token", "");
  deviceName_ = preferences_.getString("device_name", HERO_DEVICE_DEFAULT_NAME);
  configurePortalRoutes();

  if (ssid_.isEmpty()) {
    startSetupPortal();
    return;
  }

  startConnection(true);
}

void WifiProvisioning::configurePortalRoutes() {
  if (routesConfigured_) {
    return;
  }

  webServer_.on("/", HTTP_GET, [this]() { handlePortal(); });
  webServer_.on("/configure", HTTP_POST, [this]() { handleConfigure(); });
  webServer_.onNotFound([this]() { handlePortal(); });
  routesConfigured_ = true;
}

void WifiProvisioning::startConnection(bool resetAttempts) {
  dnsServer_.stop();
  if (serverStarted_) {
    webServer_.stop();
    serverStarted_ = false;
  }
  WiFi.softAPdisconnect(true);
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);

  if (resetAttempts) {
    attempt_ = 0;
  }
  retryAt_ = 0;
  portalConnectAt_ = 0;
  state_ = WifiProvisioningState::Connecting;
  startConnectionAttempt();
}

void WifiProvisioning::startConnectionAttempt() {
  ++attempt_;
  WiFi.disconnect(false, false);
  WiFi.begin(ssid_.c_str(), password_.c_str());
  attemptStartedAt_ = millis();
  retryAt_ = 0;

  Serial.printf("WiFi: connecting to %s (attempt %u/%u)\n", ssid_.c_str(),
                attempt_, HERO_WIFI_MAX_ATTEMPTS);
}

void WifiProvisioning::startSetupPortal() {
  WiFi.disconnect(true, false);
  WiFi.mode(WIFI_AP);

  const bool apStarted = WiFi.softAP(HERO_WIFI_SETUP_AP_SSID);
  if (!serverStarted_) {
    webServer_.begin();
    serverStarted_ = true;
  }
  dnsServer_.start(53, "*", WiFi.softAPIP());

  attempt_ = 0;
  retryAt_ = 0;
  portalConnectAt_ = 0;
  state_ = WifiProvisioningState::SetupPortal;

  Serial.printf("WiFi: setup AP %s (%s), IP %s\n", HERO_WIFI_SETUP_AP_SSID,
                apStarted ? "ready" : "failed", WiFi.softAPIP().toString().c_str());
}

void WifiProvisioning::handlePortal() {
  String page = R"HTML(
<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>HERO.Bot Setup</title><style>
body{font-family:Arial,sans-serif;background:#07111f;color:#fff;margin:0;padding:24px}
main{max-width:420px;margin:auto;background:#102238;padding:24px;border-radius:16px}
input,button{box-sizing:border-box;width:100%;padding:13px;margin-top:10px;border-radius:8px}
input{border:1px solid #54708f;background:#07111f;color:#fff}input[type=checkbox]{width:auto;margin-right:8px}button{border:0;background:#16c7c7;font-weight:bold}
</style></head><body><main><h1>HERO.Bot</h1><p>Configure a rede Wi-Fi.</p>
<form method="post" action="/configure"><label>SSID</label><input name="ssid" maxlength="32" required value=")HTML";
  page += htmlEscape(ssid_);
  page += R"HTML("><label>Senha Wi-Fi</label><input name="password" type="password" maxlength="63" placeholder="Deixe vazio para manter a senha atual"><label>Host do computador</label><input name="host" maxlength="64" required value=")HTML";
  page += htmlEscape(serverHost_);
  page += R"HTML("><label>Porta WebSocket</label><input name="port" type="number" min="1" max="65535" required value=")HTML";
  page += String(serverPort_);
  page += R"HTML("><label>Token compartilhado (opcional)</label><input name="token" type="password" maxlength="128" placeholder="Deixe vazio para manter o token atual"><label><input name="clear_token" type="checkbox" value="1"> Remover token armazenado</label><label>Nome do dispositivo</label><input name="device" maxlength="32" required value=")HTML";
  page += htmlEscape(deviceName_);
  page += R"HTML("><button type="submit">Salvar e conectar</button></form></main></body></html>)HTML";

  webServer_.send(200, "text/html; charset=utf-8", page);
}

void WifiProvisioning::handleConfigure() {
  const String newSsid = webServer_.arg("ssid");
  const String newPassword = webServer_.arg("password");
  const String newHost = webServer_.arg("host");
  const long requestedPort = webServer_.arg("port").toInt();
  const String newToken = webServer_.arg("token");
  const String newDeviceName = webServer_.arg("device");
  const bool clearToken = webServer_.hasArg("clear_token");

  const bool invalid = newSsid.isEmpty() || newSsid.length() > 32 ||
                       newPassword.length() > 63 || newHost.isEmpty() ||
                       newHost.length() > 64 || requestedPort < 1 ||
                       requestedPort > 65535 || newToken.length() > 128 ||
                       newDeviceName.isEmpty() || newDeviceName.length() > 32;
  if (invalid) {
    webServer_.send(400, "text/plain; charset=utf-8", "Configuracao invalida.");
    return;
  }

  ssid_ = newSsid;
  if (!newPassword.isEmpty() || password_.isEmpty()) {
    password_ = newPassword;
  }
  serverHost_ = newHost;
  serverPort_ = static_cast<uint16_t>(requestedPort);
  if (clearToken) {
    sharedToken_ = "";
  } else if (!newToken.isEmpty()) {
    sharedToken_ = newToken;
  }
  deviceName_ = newDeviceName;
  preferences_.putString("ssid", ssid_);
  preferences_.putString("password", password_);
  preferences_.putString("ws_host", serverHost_);
  preferences_.putUShort("ws_port", serverPort_);
  preferences_.putString("ws_token", sharedToken_);
  preferences_.putString("device_name", deviceName_);

  webServer_.send(200, "text/html; charset=utf-8",
                  "<h1>HERO.Bot</h1><p>Credenciais salvas. Conectando...</p>");
  portalConnectAt_ = millis() + HERO_WIFI_PORTAL_CONNECT_DELAY_MS;
}

void WifiProvisioning::schedulePortalConnection() {
  if (portalConnectAt_ == 0 || static_cast<int32_t>(millis() - portalConnectAt_) < 0) {
    return;
  }
  startConnection(true);
}

void WifiProvisioning::loop() {
  if (state_ == WifiProvisioningState::SetupPortal) {
    dnsServer_.processNextRequest();
    webServer_.handleClient();
    schedulePortalConnection();
    return;
  }

  if (state_ == WifiProvisioningState::Connected) {
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("WiFi: connection lost; starting recovery");
      startConnection(true);
    }
    return;
  }

  if (state_ != WifiProvisioningState::Connecting) {
    return;
  }

  if (WiFi.status() == WL_CONNECTED) {
    state_ = WifiProvisioningState::Connected;
    attempt_ = 0;
    Serial.printf("WiFi: connected, IP %s\n", WiFi.localIP().toString().c_str());
    return;
  }

  const uint32_t now = millis();
  if (retryAt_ != 0) {
    if (static_cast<int32_t>(now - retryAt_) >= 0) {
      startConnectionAttempt();
    }
    return;
  }

  if (now - attemptStartedAt_ < HERO_WIFI_CONNECT_TIMEOUT_MS) {
    return;
  }

  if (attempt_ >= HERO_WIFI_MAX_ATTEMPTS) {
    Serial.println("WiFi: attempts exhausted; returning to setup portal");
    startSetupPortal();
    return;
  }

  WiFi.disconnect(false, false);
  retryAt_ = now + HERO_WIFI_RETRY_DELAY_MS;
}

WifiProvisioningState WifiProvisioning::state() const {
  return state_;
}

uint8_t WifiProvisioning::attempt() const {
  return attempt_;
}

String WifiProvisioning::ipAddress() const {
  if (state_ == WifiProvisioningState::SetupPortal) {
    return WiFi.softAPIP().toString();
  }
  if (state_ == WifiProvisioningState::Connected) {
    return WiFi.localIP().toString();
  }
  return String();
}

const String& WifiProvisioning::serverHost() const {
  return serverHost_;
}

uint16_t WifiProvisioning::serverPort() const {
  return serverPort_;
}

const String& WifiProvisioning::sharedToken() const {
  return sharedToken_;
}

const String& WifiProvisioning::deviceName() const {
  return deviceName_;
}

String WifiProvisioning::htmlEscape(const String& value) const {
  String escaped;
  escaped.reserve(value.length() + 8);
  for (size_t index = 0; index < value.length(); ++index) {
    switch (value[index]) {
      case '&': escaped += F("&amp;"); break;
      case '<': escaped += F("&lt;"); break;
      case '>': escaped += F("&gt;"); break;
      case '"': escaped += F("&quot;"); break;
      case '\'': escaped += F("&#39;"); break;
      default: escaped += value[index]; break;
    }
  }
  return escaped;
}

}  // namespace herobot
