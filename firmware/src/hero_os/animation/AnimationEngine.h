#ifndef HEROBOT_ANIMATION_ENGINE_H
#define HEROBOT_ANIMATION_ENGINE_H

#include "../eventbus/HeroEvent.h"
#include <stdint.h>
#include <stddef.h>
#include <string>
#include <vector>

namespace herobot {

class AnimationEngine {
public:
    AnimationEngine();
    ~AnimationEngine();
    bool begin();
    bool loadAnimation(const std::string& id);
    void play(const std::string& id, int priority = 0);
    void stop();
    void pause();
    void resume();
    void queue(const std::string& id, int priority = 0);
    void setPriority(const std::string& id, int priority);
    void cancel(const std::string& id);

private:
    std::string currentAnimation_;
    int currentPriority_;
    bool isPaused_;
    std::vector<std::pair<std::string, int>> pendingQueue_;

    void processQueue();
    const char* stateToAnimation(HeroEventType type) const;
};

} // namespace herobot

#endif // HEROBOT_ANIMATION_ENGINE_H
