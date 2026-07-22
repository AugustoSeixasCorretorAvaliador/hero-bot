#pragma once

#include <Arduino.h>

#include "hero_event.h"

namespace herobot {

class HeroEventParser {
public:
  static bool parse(const uint8_t* data, size_t length, HeroEvent& event, String& error);
  static HeroEventType parseType(const String& type);
  static const char* canonicalTypeName(HeroEventType type);
};

}  // namespace herobot
