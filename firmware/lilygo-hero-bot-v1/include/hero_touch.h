#pragma once

#include <Arduino.h>

namespace herobot {

class HeroTouch {
public:
  bool begin();
  bool consumeTouch();
  bool prepareForDeepSleep();
  bool available() const;

private:
  uint8_t address_ = 0;
  uint32_t lastTouchAt_ = 0;

  bool probe(uint8_t address);
  void clearControllerReport();
};

}  // namespace herobot
