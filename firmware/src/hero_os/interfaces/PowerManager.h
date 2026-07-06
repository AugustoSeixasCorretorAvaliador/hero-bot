#ifndef HEROBOT_POWER_MANAGER_H
#define HEROBOT_POWER_MANAGER_H

#include <stdint.h>

namespace herobot {

class PowerManager {
public:
    virtual ~PowerManager() {}
    virtual bool begin() = 0;
    virtual uint8_t batteryLevelPercent() = 0;
    virtual bool isUSBConnected() = 0;
    virtual void enterSleep() = 0;
    virtual void wake() = 0;
};

} // namespace herobot

#endif // HEROBOT_POWER_MANAGER_H
