#include "DisplayDriver_Fake.h"

namespace herobot {

DisplayDriver_Fake::DisplayDriver_Fake() {}
DisplayDriver_Fake::~DisplayDriver_Fake() {
    if (busSubId >= 0) HeroEventBus::instance().unsubscribe(busSubId);
}

bool DisplayDriver_Fake::init() {
    busSubId = HeroEventBus::instance().subscribe([this](const HeroEvent& e){ this->onEvent(e); });
    Serial.println("DisplayDriver_Fake: initialized and subscribed to HeroEventBus");
    return true;
}

void DisplayDriver_Fake::drawFace(const FaceDescriptor& face) {
    Serial.printf("DisplayDriver_Fake: drawFace %s\n", face.id ? face.id : "(null)");
}

void DisplayDriver_Fake::drawAnimation(const FrameBuffer& frame) {
    Serial.println("DisplayDriver_Fake: drawAnimation (frame received)");
}

void DisplayDriver_Fake::drawStatus(const StatusInfo& status) {
    Serial.printf("DisplayDriver_Fake: status %s\n", status.text ? status.text : "");
}

void DisplayDriver_Fake::setBrightness(uint8_t level) {
    Serial.printf("DisplayDriver_Fake: setBrightness %d\n", level);
}

void DisplayDriver_Fake::sleep() { Serial.println("DisplayDriver_Fake: sleep"); }
void DisplayDriver_Fake::wake() { Serial.println("DisplayDriver_Fake: wake"); }

void DisplayDriver_Fake::onEvent(const HeroEvent& e) {
    if (e.type == HeroEventType::PLAY_ANIMATION) {
        Serial.print("Playing animation ");
        Serial.println(e.payload.c_str());
    }
}

} // namespace herobot
