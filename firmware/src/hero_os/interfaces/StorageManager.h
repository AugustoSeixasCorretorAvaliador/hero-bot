#ifndef HEROBOT_STORAGE_MANAGER_H
#define HEROBOT_STORAGE_MANAGER_H

#include <stdint.h>
#include <stddef.h>

namespace herobot {

class StorageManager {
public:
    virtual ~StorageManager() {}
    virtual bool begin() = 0;
    virtual bool fileExists(const char* path) = 0;
    virtual size_t readFile(const char* path, uint8_t* buffer, size_t maxlen) = 0;
};

} // namespace herobot

#endif // HEROBOT_STORAGE_MANAGER_H
