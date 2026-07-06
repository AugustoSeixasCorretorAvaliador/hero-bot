#ifndef HEROBOT_EVENT_H
#define HEROBOT_EVENT_H

#include <string>
#include <cstdint>

namespace herobot {

enum class HeroEventType {
    HERO_READY,
    HERO_OPEN,
    MENU_CLICK,
    THINKING,
    WRITING,
    SUCCESS,
    ERROR,
    LEAD_HOT,
    HOT_LEAD,
    BUSY,
    SLEEP,
    IDLE,
    WAKE,
    STARTUP,
    SHUTDOWN,
    BOOT,
    OFFLINE,
    PLAY_ANIMATION,
    UNKNOWN
};

struct HeroEvent {
    HeroEvent()
        : type(HeroEventType::UNKNOWN), timestamp(0), priority(0) {}

    std::string id;
    HeroEventType type;
    std::string source;
    uint64_t timestamp;
    std::string payload;
    int priority;
};

} // namespace herobot

#endif // HEROBOT_EVENT_H
