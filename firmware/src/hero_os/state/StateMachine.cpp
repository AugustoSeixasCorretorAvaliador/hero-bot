#include "StateMachine.h"
#include "../eventbus/HeroEventBus.h"
#include "../eventbus/HeroEvent.h"
#include <Arduino.h>

namespace herobot {

static const uint32_t DEFAULT_TIMEOUT_MS = 5000;

StateMachine::StateMachine()
    : currentState_(State::BOOT), stateStartMs_(0), busSubId_(-1) {}

StateMachine::~StateMachine() {
    if (busSubId_ >= 0) {
        HeroEventBus::instance().unsubscribe(busSubId_);
    }
}

void StateMachine::begin() {
    stateStartMs_ = millis();
    busSubId_ = HeroEventBus::instance().subscribe([this](const HeroEvent& e) { this->handleEvent(e); });
    Serial.println("StateMachine: subscribed to HeroEventBus");
    enterState(State::BOOT);
}

void StateMachine::handleEvent(const HeroEvent& e) {
    Serial.printf("StateMachine: handleEvent type=%d source=%s payload=%s priority=%d\n", (int)e.type, e.source.c_str(), e.payload.c_str(), e.priority);
    State next = eventTypeToState(e.type);
    if (next == State::UNKNOWN) {
        Serial.println("StateMachine: event does not map to a state");
        return;
    }

    if (!allowedTransition(currentState_, next)) {
        Serial.printf("StateMachine: transition %s -> %s not allowed\n", stateName(currentState_), stateName(next));
        return;
    }

    enterState(next);
    publishStateEvent(next, e.payload);
}

void StateMachine::update(uint32_t dt) {
    (void)dt;
    uint32_t now = millis();
    uint32_t elapsed = now - stateStartMs_;
    Serial.printf("StateMachine: update state=%s elapsed=%u\n", stateName(currentState_), elapsed);

    uint32_t timeout = stateTimeoutMs(currentState_);
    if (timeout > 0 && elapsed >= timeout) {
        Serial.printf("StateMachine: state %s timed out after %u ms\n", stateName(currentState_), elapsed);
        if (currentState_ == State::BOOT) {
            enterState(State::READY);
            publishStateEvent(State::READY, "boot_complete");
        } else if (currentState_ == State::THINKING || currentState_ == State::WRITING || currentState_ == State::BUSY) {
            enterState(State::IDLE);
            publishStateEvent(State::IDLE, "timeout");
        }
    }
}

StateMachine::State StateMachine::currentState() const {
    return currentState_;
}

void StateMachine::enterState(State next) {
    if (next == currentState_) {
        return;
    }
    exitState(currentState_);
    Serial.printf("StateMachine: enterState %s\n", stateName(next));
    currentState_ = next;
    stateStartMs_ = millis();
    HeroEvent play;
    play.id = "anim-" + std::string(stateName(next));
    play.type = HeroEventType::PLAY_ANIMATION;
    play.source = "StateMachine";
    play.timestamp = stateStartMs_;
    play.payload = defaultAnimation(next);
    play.priority = 0;
    HeroEventBus::instance().publish(play);
}

void StateMachine::exitState(State prev) {
    Serial.printf("StateMachine: exitState %s\n", stateName(prev));
}

bool StateMachine::allowedTransition(State from, State to) const {
    if (from == to) {
        return false;
    }
    switch (from) {
        case State::BOOT:
            return to == State::READY || to == State::OFFLINE;
        case State::READY:
            return to == State::IDLE || to == State::THINKING || to == State::BUSY || to == State::OFFLINE || to == State::SLEEP;
        case State::IDLE:
            return to == State::THINKING || to == State::WRITING || to == State::BUSY || to == State::SLEEP || to == State::OFFLINE || to == State::HOT_LEAD;
        case State::THINKING:
            return to == State::WRITING || to == State::BUSY || to == State::ERROR || to == State::SUCCESS || to == State::IDLE;
        case State::WRITING:
            return to == State::BUSY || to == State::ERROR || to == State::SUCCESS || to == State::IDLE;
        case State::BUSY:
            return to == State::SUCCESS || to == State::ERROR || to == State::IDLE || to == State::HOT_LEAD;
        case State::SUCCESS:
            return to == State::IDLE || to == State::READY || to == State::OFFLINE;
        case State::ERROR:
            return to == State::IDLE || to == State::READY || to == State::OFFLINE;
        case State::HOT_LEAD:
            return to == State::BUSY || to == State::SUCCESS || to == State::ERROR || to == State::IDLE;
        case State::SLEEP:
            return to == State::READY || to == State::OFFLINE;
        case State::OFFLINE:
            return to == State::READY || to == State::BOOT;
        default:
            return false;
    }
}

HeroEventType StateMachine::stateToEventType(State state) const {
    switch (state) {
        case State::BOOT: return HeroEventType::BOOT;
        case State::READY: return HeroEventType::HERO_READY;
        case State::IDLE: return HeroEventType::MENU_CLICK;
        case State::THINKING: return HeroEventType::THINKING;
        case State::WRITING: return HeroEventType::WRITING;
        case State::BUSY: return HeroEventType::BUSY;
        case State::SUCCESS: return HeroEventType::SUCCESS;
        case State::ERROR: return HeroEventType::ERROR;
        case State::HOT_LEAD: return HeroEventType::HOT_LEAD;
        case State::SLEEP: return HeroEventType::SLEEP;
        case State::OFFLINE: return HeroEventType::OFFLINE;
        default: return HeroEventType::UNKNOWN;
    }
}

StateMachine::State StateMachine::eventTypeToState(HeroEventType type) const {
    switch (type) {
        case HeroEventType::BOOT: return State::BOOT;
        case HeroEventType::HERO_READY: return State::READY;
        case HeroEventType::MENU_CLICK: return State::IDLE;
        case HeroEventType::THINKING: return State::THINKING;
        case HeroEventType::WRITING: return State::WRITING;
        case HeroEventType::BUSY: return State::BUSY;
        case HeroEventType::SUCCESS: return State::SUCCESS;
        case HeroEventType::ERROR: return State::ERROR;
        case HeroEventType::HOT_LEAD: return State::HOT_LEAD;
        case HeroEventType::SLEEP: return State::SLEEP;
        case HeroEventType::OFFLINE: return State::OFFLINE;
        default: return State::UNKNOWN;
    }
}

const char* StateMachine::stateName(State state) const {
    switch (state) {
        case State::BOOT: return "BOOT";
        case State::READY: return "READY";
        case State::IDLE: return "IDLE";
        case State::THINKING: return "THINKING";
        case State::WRITING: return "WRITING";
        case State::BUSY: return "BUSY";
        case State::SUCCESS: return "SUCCESS";
        case State::ERROR: return "ERROR";
        case State::HOT_LEAD: return "HOT_LEAD";
        case State::SLEEP: return "SLEEP";
        case State::OFFLINE: return "OFFLINE";
        default: return "UNKNOWN";
    }
}

uint32_t StateMachine::stateTimeoutMs(State state) const {
    switch (state) {
        case State::BOOT: return 1500;
        case State::THINKING: return 7000;
        case State::WRITING: return 5000;
        case State::BUSY: return 8000;
        default: return 0;
    }
}

const char* StateMachine::defaultAnimation(State state) const {
    switch (state) {
        case State::BOOT: return "boot";
        case State::READY: return "ready";
        case State::IDLE: return "idle";
        case State::THINKING: return "thinking";
        case State::WRITING: return "writing";
        case State::BUSY: return "busy";
        case State::SUCCESS: return "success";
        case State::ERROR: return "error";
        case State::HOT_LEAD: return "hot_lead";
        case State::SLEEP: return "sleep";
        case State::OFFLINE: return "offline";
        default: return "unknown";
    }
}

void StateMachine::publishStateEvent(State state, const std::string& payload) {
    HeroEvent stateEvent;
    stateEvent.id = std::string("state-") + stateName(state);
    stateEvent.type = stateToEventType(state);
    stateEvent.source = "StateMachine";
    stateEvent.timestamp = millis();
    stateEvent.payload = payload;
    stateEvent.priority = 0;
    HeroEventBus::instance().publish(stateEvent);
}

} // namespace herobot
