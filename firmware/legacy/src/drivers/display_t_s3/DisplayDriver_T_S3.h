#ifndef DISPLAY_DRIVER_T_S3_H
#define DISPLAY_DRIVER_T_S3_H

#include "../../hal/display/DisplayManager.h"

namespace herobot {

class DisplayDriver_T_S3 : public DisplayManager {
public:
    DisplayDriver_T_S3() {}
    virtual ~DisplayDriver_T_S3() {}
    bool init() override { return true; }
    void drawFace(const FaceDescriptor& face) override {}
    void drawAnimation(const FrameBuffer& frame) override {}
    void drawStatus(const StatusInfo& status) override {}
    void setBrightness(uint8_t level) override {}
    void sleep() override {}
    void wake() override {}
};

} // namespace herobot

#endif // DISPLAY_DRIVER_T_S3_H
