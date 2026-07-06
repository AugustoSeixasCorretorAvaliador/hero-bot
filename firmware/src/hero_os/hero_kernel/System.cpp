#include "System.h"
#include <Arduino.h>

namespace herobot {

void System::init() {
    // Minimal system init placeholder. Real init will orchestrate HAL subsystems.
    Serial.begin(115200);
}

} // namespace herobot
