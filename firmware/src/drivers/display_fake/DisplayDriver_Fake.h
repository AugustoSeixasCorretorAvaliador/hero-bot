#ifndef DISPLAY_DRIVER_FAKE_H
#define DISPLAY_DRIVER_FAKE_H

#include "../../hero_os/interfaces/DisplayManager.h"
#include "../../hero_os/eventbus/HeroEventBus.h"
#include "../../hero_os/eventbus/HeroEvent.h"
#include <Arduino.h>

namespace herobot {

class DisplayDriver_Fake : public DisplayManager {
public:
    DisplayDriver_Fake();
    virtual ~DisplayDriver_Fake();
    bool init() override;
    void drawFace(const FaceDescriptor& face) override;
    void drawAnimation(const FrameBuffer& frame) override;
    void drawStatus(const StatusInfo& status) override;
    void setBrightness(uint8_t level) override;
    void sleep() override;
    void wake() override;

private:
    int busSubId = -1;
    void onEvent(const HeroEvent& e);
};

} // namespace herobot

#endif // DISPLAY_DRIVER_FAKE_H
