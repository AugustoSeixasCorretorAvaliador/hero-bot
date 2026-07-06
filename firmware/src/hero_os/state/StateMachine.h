#ifndef HEROBOT_STATE_MACHINE_H
#define HEROBOT_STATE_MACHINE_H

#include "../eventbus/HeroEvent.h"
#include <stdint.h>
#include <string>

namespace herobot {

class StateMachine {
public:
    enum class State {
        BOOT,
        READY,
        IDLE,
        THINKING,
        WRITING,
        BUSY,
        SUCCESS,
        ERROR,
        HOT_LEAD,
        SLEEP,
        OFFLINE,
        UNKNOWN
    };

    StateMachine();
    ~StateMachine();
    void begin();
    void handleEvent(const HeroEvent& e);
    void update(uint32_t dt);
    State currentState() const;

private:
    State currentState_;
    uint32_t stateStartMs_;
    int busSubId_;

    void enterState(State next);
    void exitState(State prev);
    bool allowedTransition(State from, State to) const;
    HeroEventType stateToEventType(State state) const;
    State eventTypeToState(HeroEventType type) const;
    const char* stateName(State state) const;
    uint32_t stateTimeoutMs(State state) const;
    const char* defaultAnimation(State state) const;
    void publishStateEvent(State state, const std::string& payload = "");
};

} // namespace herobot

#endif // HEROBOT_STATE_MACHINE_H
