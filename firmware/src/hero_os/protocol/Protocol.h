#ifndef HEROBOT_PROTOCOL_H
#define HEROBOT_PROTOCOL_H

#include "../eventbus/HeroEvent.h"
#include <string>

namespace herobot {

inline HeroEventType parseHeroEvent(const std::string& s) {
    if (s == "HERO_READY") return HeroEventType::HERO_READY;
    if (s == "HERO_OPEN") return HeroEventType::HERO_OPEN;
    if (s == "MENU_CLICK") return HeroEventType::MENU_CLICK;
    if (s == "THINKING") return HeroEventType::THINKING;
    if (s == "WRITING") return HeroEventType::WRITING;
    if (s == "SUCCESS") return HeroEventType::SUCCESS;
    if (s == "ERROR") return HeroEventType::ERROR;
    if (s == "LEAD_HOT") return HeroEventType::LEAD_HOT;
    if (s == "HOT_LEAD") return HeroEventType::HOT_LEAD;
    if (s == "BUSY") return HeroEventType::BUSY;
    if (s == "IDLE") return HeroEventType::IDLE;
    if (s == "SLEEP") return HeroEventType::SLEEP;
    if (s == "BOOT") return HeroEventType::BOOT;
    if (s == "OFFLINE") return HeroEventType::OFFLINE;
    if (s == "PLAY_ANIMATION") return HeroEventType::PLAY_ANIMATION;
    return HeroEventType::UNKNOWN;
}

} // namespace herobot

#endif // HEROBOT_PROTOCOL_H
