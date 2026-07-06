#ifndef HEROBOT_OTA_SERVICE_H
#define HEROBOT_OTA_SERVICE_H

#include <string>

namespace herobot {

class OTAService {
public:
    OTAService() {}
    ~OTAService() {}
    bool begin() { return true; }
    bool checkForUpdate(const std::string& /*url*/) { return false; }
};

} // namespace herobot

#endif // HEROBOT_OTA_SERVICE_H
