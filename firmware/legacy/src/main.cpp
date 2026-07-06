// Legacy copy of src/main.cpp (Tabbie firmware entrypoint)
// Copied to legacy/ for cleanup review. Original file remains in src/.

#include <Wire.h>
#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <U8g2lib.h>
#include <Preferences.h>
#include <ESPmDNS.h>
#include <DNSServer.h>
#include <ESP32Servo.h>

// HERO.Bot test mode flag (can be set via build flag)
#ifndef HERO_BOT_TEST_MODE
#define HERO_BOT_TEST_MODE 0
#endif

// HERO.Bot core headers (stubs/scaffold)
#include "hero_os/hero_kernel/System.h"
#include "hero_os/eventbus/HeroEvent.h"
#include "hero_os/eventbus/HeroEventBus.h"
#include "drivers/display_fake/DisplayDriver_Fake.h"
#include "hero_os/animation/AnimationEngine.h"
#include "hero_os/state/StateMachine.h"

// ============================================
// SERVO CONFIGURATION (SIMPLIFIED)
// ============================================
const int SERVO_PIN = 13;
Servo neckServo;

// Servo positions (degrees)
const int SERVO_LEFT = 15;
const int SERVO_CENTER = 90;
const int SERVO_RIGHT = 165;

// Servo movement
int currentServoPos = SERVO_CENTER;
int targetServoPos = SERVO_CENTER;
const int SERVO_SPEED = 8; // degrees per step (lower = slower)

// Flag: Was animation triggered via API? (forces servo active on first loop)
bool animationTriggeredViaAPI = false;

// For idle: track loops for automatic mode (every 4th loop)
int idleLoopCount = 0;
const int IDLE_SERVO_EVERY_N_LOOPS = 4;

// For paused: shake timer
unsigned long lastPausedShakeTime = 0;

// For focus: progress tracking
unsigned long focusStartTime = 0;
unsigned long focusDuration = 0;
bool focusHalfwayDone = false;

// Animation data
#include "idle01.h"
#include "focus01.h"
#include "relax01.h"
#include "love01.h"
#include "startup01.h"
#include "angry_bitmap.h"  // Keep angry as static image

// OLED display configuration - Using U8g2 with SH1106 driver
U8G2_SH1106_128X64_NONAME_F_HW_I2C display(U8G2_R0, /* reset=*/ U8X8_PIN_NONE);

// Web server on port 80
WebServer server(80);

// DNS server for captive portal
DNSServer dnsServer;

// WiFi credentials storage
Preferences preferences;

// Current state
String currentAnimation = "startup";
String currentTask = "";
unsigned long animationStartTime = 0;
unsigned long startupTime = 0;
bool hasCompletedStartup = false;
bool isInSetupMode = false;
String wifiStatus = "disconnected";
String lastError = "";

// WiFi connection state machine
String savedSSID = "";
String savedPassword = "";
unsigned long wifiConnectStartTime = 0;
bool wifiInitialized = false;
bool wifiConnecting = false;
bool webServerStarted = false;

const int MAX_WIFI_ATTEMPTS = 3;
int wifiAttemptCount = 0;
unsigned long wifiRetryWaitUntil = 0;

// Debug mode - shows device info on OLED when triggered
bool isDebugMode = false;
unsigned long debugModeStartTime = 0;
const unsigned long DEBUG_MODE_DURATION = 8000; // Show debug info for 8 seconds

// Physical button for showing debug info
// Using GPIO27 - safe pin that's not a strapping pin
const int DEBUG_BUTTON_PIN = 27;
unsigned long lastButtonPress = 0;
const unsigned long BUTTON_DEBOUNCE_MS = 300; // Debounce time

// Setup mode configuration
const char* SETUP_SSID = "Tabbie-Setup";
const char* MDNS_NAME = "tabbie";

// Function declarations
void setupDisplay();
void loadWiFiCredentials();
void handleWiFiConnection();
void startSetupMode();
void startNormalMode();
void setupWebServer();
void setupMDNS();
void handleRoot();
void handleSetupPage();
void handleWiFiConfig();
void handleStatus();
void handleAnimation();
void handleWiFiSettings();
void handleCORS();
void updateDisplay();
void drawSetupMode();
void drawConnecting();
void drawConnected();
void drawError();
void drawIdleAnimation();
void drawFocusAnimation();
void drawRelaxAnimation();
void drawLoveAnimation();
void drawStartupAnimation();
void drawAngryImage();
void drawPomodoroAnimation();
void drawTaskCompleteAnimation();
void drawDebugInfo();
void handleDebug();
void handleReset();
void handleServoTest();
void checkDebugButton();
void prepareWiFiForRetry(unsigned long delayMs = 0);
void onWiFiConnectionFailure(const String& reason);

// Servo functions
void setupServo();
void moveServoTo(int position);
void updateServoMovement();

void setup() {
  Serial.begin(115200);
  Serial.println("🤖 Tabbie Assistant Starting...");
  
  // Record startup time
  startupTime = millis();
  
  // Setup debug button (GPIO0 = BOOT button on most ESP32 boards)
  pinMode(DEBUG_BUTTON_PIN, INPUT_PULLUP);
  
  // CRITICAL: Clean WiFi state from any previous boot/mode
  // This prevents issues when switching between AP and STA modes
  WiFi.persistent(false);  // Don't save WiFi config to flash
  WiFi.disconnect(true);   // Disconnect and clear saved credentials
  WiFi.mode(WIFI_OFF);     // Turn off WiFi completely
  delay(200);              // Give hardware time to reset
  wifiAttemptCount = 0;
  wifiRetryWaitUntil = 0;
  
  // Initialize components
  setupDisplay();
  setupServo();
  
  // Initialize preferences
  preferences.begin("tabbie", false);
  
  // Load WiFi credentials (don't connect yet - animations first!)
  loadWiFiCredentials();
  
  // DON'T setup web server here - it will be started in startNormalMode() or startSetupMode()
  // after WiFi is properly initialized
  
  Serial.println("✅ Tabbie initialized - animations will play while WiFi connects");

#if HERO_BOT_TEST_MODE
  Serial.println("=== HERO.Bot TEST MODE START ===");
  // Initialize HERO.Bot core scaffolds
  herobot::System::init();

  static herobot::DisplayDriver_Fake displayFake;
  displayFake.init();

  static herobot::AnimationEngine animEngine;
  animEngine.begin();

  static herobot::StateMachine stateMachine;
  stateMachine.begin();

  // Publish a sequence of events to validate event flow
  {
    using herobot::HeroEvent;
    using herobot::HeroEventType;

    HeroEvent e;
    e.source = "test";
    e.priority = 0;

    e.id = std::string("evt-01"); e.type = HeroEventType::HERO_READY; e.timestamp = millis(); e.payload = ""; HeroEventBus::instance().publish(e); delay(200);
    e.id = std::string("evt-02"); e.type = HeroEventType::HERO_OPEN;  e.timestamp = millis(); e.payload = ""; HeroEventBus::instance().publish(e); delay(200);
    e.id = std::string("evt-03"); e.type = HeroEventType::THINKING;   e.timestamp = millis(); e.payload = "THINKING"; HeroEventBus::instance().publish(e); delay(200);
    e.id = std::string("evt-04"); e.type = HeroEventType::WRITING;    e.timestamp = millis(); e.payload = "WRITING"; HeroEventBus::instance().publish(e); delay(200);
    e.id = std::string("evt-05"); e.type = HeroEventType::SUCCESS;    e.timestamp = millis(); e.payload = "SUCCESS"; HeroEventBus::instance().publish(e); delay(200);
    e.id = std::string("evt-06"); e.type = HeroEventType::ERROR;      e.timestamp = millis(); e.payload = "ERROR"; HeroEventBus::instance().publish(e); delay(200);
    e.id = std::string("evt-07"); e.type = HeroEventType::LEAD_HOT;   e.timestamp = millis(); e.payload = "LEAD_HOT"; HeroEventBus::instance().publish(e); delay(200);
    e.id = std::string("evt-08"); e.type = HeroEventType::SLEEP;      e.timestamp = millis(); e.payload = "SLEEP"; HeroEventBus::instance().publish(e); delay(200);
  }

  Serial.println("=== HERO.Bot TEST MODE DONE ===");
#endif
}

// (The rest of the original main.cpp is intentionally omitted from this legacy copy for brevity.)
