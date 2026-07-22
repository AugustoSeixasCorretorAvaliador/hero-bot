#include "hero_event_parser.h"

#include <ArduinoJson.h>

#include "hero_app_config.h"

namespace herobot {

HeroEventType HeroEventParser::parseType(const String& type) {
  if (type == "BOOT") return HeroEventType::BOOT;
  if (type == "READY" || type == "HERO_READY") return HeroEventType::HERO_READY;
  if (type == "HERO_OPEN") return HeroEventType::HERO_OPEN;
  if (type == "IDLE") return HeroEventType::IDLE;
  if (type == "THINKING") return HeroEventType::THINKING;
  if (type == "WRITING") return HeroEventType::WRITING;
  if (type == "SUCCESS") return HeroEventType::SUCCESS;
  if (type == "ERROR") return HeroEventType::ERROR;
  if (type == "HOT_LEAD" || type == "LEAD_HOT") return HeroEventType::LEAD_HOT;
  if (type == "SLEEP") return HeroEventType::SLEEP;
  if (type == "OFFLINE") return HeroEventType::OFFLINE;
  return HeroEventType::UNKNOWN;
}

const char* HeroEventParser::canonicalTypeName(HeroEventType type) {
  switch (type) {
    case HeroEventType::BOOT: return "BOOT";
    case HeroEventType::HERO_READY: return "HERO_READY";
    case HeroEventType::HERO_OPEN: return "HERO_OPEN";
    case HeroEventType::IDLE: return "IDLE";
    case HeroEventType::THINKING: return "THINKING";
    case HeroEventType::WRITING: return "WRITING";
    case HeroEventType::SUCCESS: return "SUCCESS";
    case HeroEventType::ERROR: return "ERROR";
    case HeroEventType::LEAD_HOT: return "LEAD_HOT";
    case HeroEventType::SLEEP: return "SLEEP";
    case HeroEventType::OFFLINE: return "OFFLINE";
    case HeroEventType::UNKNOWN: return "UNKNOWN";
  }
  return "UNKNOWN";
}

bool HeroEventParser::parse(const uint8_t* data, size_t length, HeroEvent& event, String& error) {
  if (data == nullptr || length == 0 || length > HERO_WS_MAX_MESSAGE_BYTES) {
    error = "invalid_message_size";
    return false;
  }

  JsonDocument document;
  const DeserializationError jsonError = deserializeJson(
      document, data, length, DeserializationOption::NestingLimit(6));
  if (jsonError) {
    error = "invalid_json";
    return false;
  }
  if (!document.is<JsonObject>()) {
    error = "message_must_be_object";
    return false;
  }

  const String id = document["id"] | "";
  const String rawType = document["type"] | "";
  const String source = document["source"] | "";
  const String target = document["target"] | "broadcast";

  if (id.isEmpty() || id.length() > 128) {
    error = "invalid_id";
    return false;
  }
  if (rawType.isEmpty() || rawType.length() > 32) {
    error = "invalid_event_type";
    return false;
  }
  if (source.isEmpty() || source.length() > 64 || target.length() > 64) {
    error = "invalid_envelope_field";
    return false;
  }

  const HeroEventType parsedType = parseType(rawType);
  if (parsedType == HeroEventType::UNKNOWN) {
    error = "invalid_event_type";
    return false;
  }

  event.id = id;
  event.type = parsedType;
  event.typeName = canonicalTypeName(parsedType);
  event.source = source;
  event.target = target;
  event.timestamp = document["timestamp"] | 0ULL;
  event.payloadJson = "{}";
  if (!document["payload"].isNull()) {
    event.payloadJson = "";
    serializeJson(document["payload"], event.payloadJson);
  }

  error = "";
  return true;
}

}  // namespace herobot
