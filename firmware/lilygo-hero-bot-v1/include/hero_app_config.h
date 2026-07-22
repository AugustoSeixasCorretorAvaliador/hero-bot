#pragma once

#include <stdint.h>
#include <stddef.h>

constexpr char HERO_WIFI_NVS_NAMESPACE[] = "hero_wifi";
constexpr char HERO_WIFI_SETUP_AP_SSID[] = "HERO-BOT-SETUP";
constexpr uint8_t HERO_WIFI_MAX_ATTEMPTS = 3;
constexpr uint32_t HERO_WIFI_CONNECT_TIMEOUT_MS = 15000;
constexpr uint32_t HERO_WIFI_RETRY_DELAY_MS = 1000;
constexpr uint32_t HERO_WIFI_PORTAL_CONNECT_DELAY_MS = 1000;

constexpr char HERO_WS_DEFAULT_HOST[] = "hero-host.local";
constexpr uint16_t HERO_WS_DEFAULT_PORT = 8765;
constexpr char HERO_DEVICE_DEFAULT_NAME[] = "hero-bot-001";
constexpr uint32_t HERO_WS_RECONNECT_INTERVAL_MS = 2000;
constexpr uint32_t HERO_WS_PING_INTERVAL_MS = 15000;
constexpr uint32_t HERO_WS_PONG_TIMEOUT_MS = 5000;
constexpr uint8_t HERO_WS_DISCONNECT_AFTER_MISSED_PONGS = 2;
constexpr uint32_t HERO_WS_APP_HEARTBEAT_INTERVAL_MS = 30000;
constexpr size_t HERO_WS_MAX_MESSAGE_BYTES = 4096;

constexpr uint32_t HERO_DISPLAY_IDLE_TIMEOUT_MS = 180000;
constexpr uint32_t HERO_DEEP_SLEEP_IDLE_TIMEOUT_MS = 7200000;
constexpr uint32_t HERO_BATTERY_REFRESH_INTERVAL_MS = 30000;
constexpr uint8_t HERO_BATTERY_SAMPLE_COUNT = 12;
