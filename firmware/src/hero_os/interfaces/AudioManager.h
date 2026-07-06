#ifndef HEROBOT_AUDIO_MANAGER_H
#define HEROBOT_AUDIO_MANAGER_H

#include <stdint.h>

namespace herobot {

class AudioManager {
public:
    virtual ~AudioManager() {}
    virtual bool init() = 0;
    virtual void playTone(uint16_t freq, uint16_t ms) = 0;
    virtual void stop() = 0;
};

} // namespace herobot

#endif // HEROBOT_AUDIO_MANAGER_H
