#include "AnimationEngine.h"
#include "../eventbus/HeroEventBus.h"
#include "../eventbus/HeroEvent.h"
#include <Arduino.h>
#include <algorithm>

namespace herobot {

static int busSubId = -1;

AnimationEngine::AnimationEngine()
    : currentPriority_(-1), isPaused_(false) {}

AnimationEngine::~AnimationEngine() {
    if (busSubId >= 0) {
        HeroEventBus::instance().unsubscribe(busSubId);
    }
}

bool AnimationEngine::begin() {
    busSubId = HeroEventBus::instance().subscribe([this](const HeroEvent& e) {
        if (e.type == HeroEventType::PLAY_ANIMATION) {
            return;
        }

        const char* anim = stateToAnimation(e.type);
        if (anim) {
            String animationId(anim);
            Serial.printf("AnimationEngine: enqueue animation for state event=%d anim=%s priority=%d\n", (int)e.type, anim, e.priority);
            queue(animationId.c_str(), e.priority);
        }
    });
    Serial.println("AnimationEngine: subscribed to HeroEventBus");
    return true;
}

bool AnimationEngine::loadAnimation(const std::string& id) {
    Serial.printf("AnimationEngine: loadAnimation %s\n", id.c_str());
    return true;
}

void AnimationEngine::play(const std::string& id, int priority) {
    if (id.empty()) {
        return;
    }
    if (!currentAnimation_.empty() && priority < currentPriority_) {
        Serial.printf("AnimationEngine: lower-priority play skipped %s (p=%d) current=%s (p=%d)\n", id.c_str(), priority, currentAnimation_.c_str(), currentPriority_);
        cancel(id);
        return;
    }

    currentAnimation_ = id;
    currentPriority_ = priority;
    isPaused_ = false;
    Serial.printf("AnimationEngine: play animation %s (p=%d)\n", id.c_str(), priority);
    HeroEvent play;
    play.id = "play-" + id;
    play.type = HeroEventType::PLAY_ANIMATION;
    play.source = "AnimationEngine";
    play.timestamp = millis();
    play.payload = id;
    play.priority = priority;
    HeroEventBus::instance().publish(play);
}

void AnimationEngine::stop() {
    Serial.println("AnimationEngine: stop");
    currentAnimation_.clear();
    currentPriority_ = -1;
    pendingQueue_.clear();
}

void AnimationEngine::pause() {
    if (!currentAnimation_.empty()) {
        isPaused_ = true;
        Serial.printf("AnimationEngine: pause %s\n", currentAnimation_.c_str());
    }
}

void AnimationEngine::resume() {
    if (isPaused_) {
        isPaused_ = false;
        Serial.printf("AnimationEngine: resume %s\n", currentAnimation_.c_str());
    }
}

void AnimationEngine::queue(const std::string& id, int priority) {
    if (id.empty()) {
        return;
    }
    if (currentAnimation_.empty() || priority > currentPriority_) {
        play(id, priority);
        return;
    }
    pendingQueue_.emplace_back(id, priority);
    Serial.printf("AnimationEngine: queued animation %s (p=%d)\n", id.c_str(), priority);
}

void AnimationEngine::setPriority(const std::string& id, int priority) {
    for (auto &entry : pendingQueue_) {
        if (entry.first == id) {
            entry.second = priority;
            Serial.printf("AnimationEngine: setPriority %s -> %d\n", id.c_str(), priority);
            break;
        }
    }
}

void AnimationEngine::cancel(const std::string& id) {
    if (currentAnimation_ == id) {
        Serial.printf("AnimationEngine: cancel current animation %s\n", id.c_str());
        currentAnimation_.clear();
        currentPriority_ = -1;
    }
    pendingQueue_.erase(
        std::remove_if(pendingQueue_.begin(), pendingQueue_.end(), [&](const std::pair<std::string,int>& entry) {
            return entry.first == id;
        }),
        pendingQueue_.end());
    Serial.printf("AnimationEngine: cancel queued animation %s\n", id.c_str());
    processQueue();
}

void AnimationEngine::processQueue() {
    if (currentAnimation_.empty() && !pendingQueue_.empty()) {
        auto next = pendingQueue_.front();
        pendingQueue_.erase(pendingQueue_.begin());
        play(next.first, next.second);
    }
}

const char* AnimationEngine::stateToAnimation(HeroEventType type) const {
    switch (type) {
        case HeroEventType::BOOT: return "boot";
        case HeroEventType::HERO_READY: return "ready";
        case HeroEventType::MENU_CLICK: return "idle";
        case HeroEventType::THINKING: return "thinking";
        case HeroEventType::WRITING: return "writing";
        case HeroEventType::BUSY: return "busy";
        case HeroEventType::SUCCESS: return "success";
        case HeroEventType::ERROR: return "error";
        case HeroEventType::HOT_LEAD: return "hot_lead";
        case HeroEventType::SLEEP: return "sleep";
        case HeroEventType::OFFLINE: return "offline";
        default: return nullptr;
    }
}

} // namespace herobot
