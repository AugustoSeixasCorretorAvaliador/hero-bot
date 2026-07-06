# Cleanup Legacy (draft)

Goal: identify legacy / Tabbie-specific files and categorize them so we can move them to `legacy/` before any destructive changes.

Keep (core / reuse):
- src/hero_os/** (all core eventbus, animation, state, interfaces)
- src/drivers/display_fake/** (fake display used by tests and simulator)
- src/animation/* (animation headers used by HeroOS)
- src/hero_os/protocol/Protocol.h

Move to legacy/ (tabbie-specific hardware and UX glue):
- src/main.cpp  — ESP32 main with WiFi, servo, web server
- src/hal/** (hardware abstraction with board-specific code)
- src/drivers/display_t_s3/** (lilygo t-display driver)
- src/ota/** (OTA service specific to firmware)
- src/network/** (web server pages and captive portal)

Remove (candidates after review):
- any duplicate wrapper headers in src/core/* that only re-export hero_os headers (keep only if needed)

Convert later:
- animation header files (idle01.h etc) → move to assets/animations JSON or image sequences for simulator

Next steps before moving files:
1. Create `legacy/` directory at repo root or under firmware.
2. Copy (do not delete) files into `legacy/` and update CLEANUP_LEGACY.md with exact paths.
3. Run full PlatformIO build to ensure nothing breaks.
