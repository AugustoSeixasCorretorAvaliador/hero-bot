#include <Arduino.h>
#include "hero_os/hero_kernel/System.h"
#include "hero_os/eventbus/HeroEvent.h"
#include "hero_os/eventbus/HeroEventBus.h"
#include "drivers/display_fake/DisplayDriver_Fake.h"
#include "hero_os/animation/AnimationEngine.h"
#include "hero_os/state/StateMachine.h"

static herobot::DisplayDriver_Fake displayFake;
static herobot::AnimationEngine animEngine;
static herobot::StateMachine stateMachine;

void setup() {
    Serial.begin(115200);
    Serial.println("=== HERO.Bot Test Entrypoint ===");

    herobot::System::init();

    displayFake.init();
    animEngine.begin();
    stateMachine.begin();

    using herobot::HeroEvent;
    using herobot::HeroEventType;
    using herobot::HeroEventBus;

    HeroEvent e;
    e.source = "test";
    e.priority = 0;

    e.id = "evt-01"; e.type = HeroEventType::BOOT;      e.timestamp = millis(); e.payload = ""; HeroEventBus::instance().publish(e); delay(100);
    e.id = "evt-02"; e.type = HeroEventType::HERO_READY; e.timestamp = millis(); e.payload = ""; HeroEventBus::instance().publish(e); delay(100);
    e.id = "evt-03"; e.type = HeroEventType::THINKING;   e.timestamp = millis(); e.payload = "THINKING"; HeroEventBus::instance().publish(e); delay(100);
    e.id = "evt-04"; e.type = HeroEventType::WRITING;    e.timestamp = millis(); e.payload = "WRITING"; HeroEventBus::instance().publish(e); delay(100);
    e.id = "evt-05"; e.type = HeroEventType::SUCCESS;    e.timestamp = millis(); e.payload = "SUCCESS"; HeroEventBus::instance().publish(e); delay(100);
    e.id = "evt-06"; e.type = HeroEventType::ERROR;      e.timestamp = millis(); e.payload = "ERROR"; HeroEventBus::instance().publish(e); delay(100);
    e.id = "evt-07"; e.type = HeroEventType::HOT_LEAD;   e.timestamp = millis(); e.payload = "HOT_LEAD"; HeroEventBus::instance().publish(e); delay(100);
    e.id = "evt-08"; e.type = HeroEventType::SLEEP;      e.timestamp = millis(); e.payload = "SLEEP"; HeroEventBus::instance().publish(e); delay(100);
    e.id = "evt-09"; e.type = HeroEventType::OFFLINE;    e.timestamp = millis(); e.payload = "OFFLINE"; HeroEventBus::instance().publish(e); delay(100);

    Serial.println("=== HERO.Bot Test Sequence Published ===");
}

void loop() {
    static uint32_t lastUpdate = 0;
    uint32_t now = millis();
    if (now - lastUpdate >= 500) {
        lastUpdate = now;
        stateMachine.update(500);
    }
    delay(10);
}
