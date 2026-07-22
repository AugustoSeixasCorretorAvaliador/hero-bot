#pragma once

#include <Arduino.h>

namespace herobot {

enum class HeroEventType : uint8_t {
  BOOT,
  HERO_READY,
  HERO_OPEN,
  IDLE,
  THINKING,
  WRITING,
  SUCCESS,
  ERROR,
  LEAD_HOT,
  SLEEP,
  OFFLINE,
  UNKNOWN,
};

struct HeroEvent {
  String id;
  HeroEventType type = HeroEventType::UNKNOWN;
  String typeName;
  String source;
  String target;
  uint64_t timestamp = 0;
  String payloadJson;
};

}  // namespace herobot
