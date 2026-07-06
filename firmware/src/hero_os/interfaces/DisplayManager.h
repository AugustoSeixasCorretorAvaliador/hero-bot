#ifndef HEROBOT_DISPLAY_MANAGER_H
#define HEROBOT_DISPLAY_MANAGER_H

#include <stdint.h>

namespace herobot {

struct FaceDescriptor {
    const char* id;
};

struct FrameBuffer {
    const uint8_t* data;
    uint16_t width;
    uint16_t height;
};

struct StatusInfo {
    const char* text;
};

class DisplayManager {
public:
    virtual ~DisplayManager() {}
    virtual bool init() = 0;
    virtual void drawFace(const FaceDescriptor& face) = 0;
    virtual void drawAnimation(const FrameBuffer& frame) = 0;
    virtual void drawStatus(const StatusInfo& status) = 0;
    virtual void setBrightness(uint8_t level) = 0;
    virtual void sleep() = 0;
    virtual void wake() = 0;
};

} // namespace herobot

#endif // HEROBOT_DISPLAY_MANAGER_H
