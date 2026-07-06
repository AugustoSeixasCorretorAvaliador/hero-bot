#ifndef HEROBOT_EVENT_BUS_H
#define HEROBOT_EVENT_BUS_H

#include "HeroEvent.h"
#include <functional>
#include <vector>
#include <deque>

namespace herobot {

using EventHandler = std::function<void(const HeroEvent&)>;

class HeroEventBus {
public:
    static HeroEventBus& instance();
    int subscribe(EventHandler h);
    void unsubscribe(int id);
    void publish(const HeroEvent& e);

private:
    HeroEventBus();
    void processQueue();

    std::vector<EventHandler> handlers;
    std::vector<int> freeIds;
    std::deque<HeroEvent> eventQueue;
    int nextId = 0;
};

} // namespace herobot

#endif // HEROBOT_EVENT_BUS_H
