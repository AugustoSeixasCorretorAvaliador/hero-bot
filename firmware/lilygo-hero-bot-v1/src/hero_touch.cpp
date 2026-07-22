#include "hero_touch.h"

#include <Wire.h>

#include "hero_tdisplay_s3_config.h"

namespace herobot {

namespace {
constexpr uint8_t CST328_ADDRESS = 0x1A;
constexpr uint8_t CST816_ADDRESS = 0x15;
constexpr uint32_t TOUCH_DEBOUNCE_MS = 180;
volatile bool touchPending = false;

void IRAM_ATTR handleTouchInterrupt() {
  touchPending = true;
}
}  // namespace

bool HeroTouch::begin() {
  pinMode(HERO_TOUCH_RESET_PIN, OUTPUT);
  digitalWrite(HERO_TOUCH_RESET_PIN, LOW);
  delay(200);
  digitalWrite(HERO_TOUCH_RESET_PIN, HIGH);
  delay(200);

  Wire.begin(HERO_TOUCH_I2C_SDA_PIN, HERO_TOUCH_I2C_SCL_PIN);
  if (probe(CST328_ADDRESS)) address_ = CST328_ADDRESS;
  else if (probe(CST816_ADDRESS)) address_ = CST816_ADDRESS;
  else {
    Serial.println("Touch: controlador CST nao encontrado");
    return false;
  }

  pinMode(HERO_TOUCH_INTERRUPT_PIN, INPUT_PULLUP);
  touchPending = false;
  attachInterrupt(digitalPinToInterrupt(HERO_TOUCH_INTERRUPT_PIN),
                  handleTouchInterrupt, FALLING);
  Serial.printf("Touch: controlador %s detectado em 0x%02X\n",
                address_ == CST328_ADDRESS ? "CST328" : "CST816",
                address_);
  return true;
}

bool HeroTouch::consumeTouch() {
  if (!available() || !touchPending) return false;

  noInterrupts();
  touchPending = false;
  interrupts();
  clearControllerReport();

  const uint32_t now = millis();
  if (now - lastTouchAt_ < TOUCH_DEBOUNCE_MS) return false;
  lastTouchAt_ = now;
  return true;
}

bool HeroTouch::prepareForDeepSleep() {
  if (!available()) return false;

  clearControllerReport();
  delay(20);
  if (digitalRead(HERO_TOUCH_INTERRUPT_PIN) == LOW) {
    clearControllerReport();
    delay(20);
  }
  return digitalRead(HERO_TOUCH_INTERRUPT_PIN) == HIGH;
}

bool HeroTouch::available() const {
  return address_ != 0;
}

bool HeroTouch::probe(uint8_t address) {
  Wire.beginTransmission(address);
  return Wire.endTransmission() == 0;
}

void HeroTouch::clearControllerReport() {
  Wire.beginTransmission(address_);
  if (address_ == CST328_ADDRESS) {
    Wire.write(0xD0);
    Wire.write(0x00);
  } else {
    Wire.write(0x00);
  }
  if (Wire.endTransmission(false) == 0) {
    const uint8_t bytesToRead = address_ == CST328_ADDRESS ? 7 : 7;
    Wire.requestFrom(address_, bytesToRead);
    while (Wire.available()) Wire.read();
  }

  if (address_ == CST328_ADDRESS) {
    Wire.beginTransmission(address_);
    Wire.write(0xD0);
    Wire.write(0x00);
    Wire.write(0xAB);
    Wire.endTransmission();
  }
}

}  // namespace herobot
