#include "HeroEventBus.h"
#include <Arduino.h>

namespace herobot {

HeroEventBus& HeroEventBus::instance() {
    static HeroEventBus bus;
    return bus;
}

HeroEventBus::HeroEventBus() {}

int HeroEventBus::subscribe(EventHandler h) {
    int id;
    if (!freeIds.empty()) {
        id = freeIds.back();
        freeIds.pop_back();
        handlers[id] = h;
    } else {
        id = nextId++;
        handlers.push_back(h);
    }
    Serial.printf("HeroEventBus: subscribe id=%d handlers=%d\n", id, (int)handlers.size());
    return id;
}

void HeroEventBus::unsubscribe(int id) {
    if (id >= 0 && id < (int)handlers.size()) {
        handlers[id] = nullptr;
        freeIds.push_back(id);
        Serial.printf("HeroEventBus: unsubscribe id=%d\n", id);
    }
}

void HeroEventBus::publish(const HeroEvent& e) {
    Serial.printf("HeroEventBus: publish event=%d source=%s priority=%d\n", (int)e.type, e.source.c_str(), e.priority);
    auto insertPos = eventQueue.begin();
    while (insertPos != eventQueue.end() && insertPos->priority >= e.priority) {
        ++insertPos;
    }
    eventQueue.insert(insertPos, e);
    processQueue();
}

void HeroEventBus::processQueue() {
    while (!eventQueue.empty()) {
        HeroEvent event = eventQueue.front();
        eventQueue.pop_front();
        for (auto &handler : handlers) {
            if (handler) {
                handler(event);
            }
        }
    }
}

} // namespace herobot
