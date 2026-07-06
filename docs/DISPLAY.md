# DISPLAY — DisplayManager and TFT integration

Objetivo: substituir o U8g2/OLED monocromático por uma camada `DisplayManager` que suporte displays TFT coloridos (Lilygo T-Display S3).

Interface proposta (`hal/display/DisplayManager.h`)
- `bool init()`
- `void drawFace(const FaceDescriptor&)`
- `void drawAnimation(const FrameBuffer&)`
- `void drawStatus(const StatusInfo&)`
- `void setBrightness(uint8_t)`
- `void sleep()` / `void wake()`

Driver recomendados
- `TFT_eSPI` ou `LovyanGFX` com configuração para S3. Prefer `LovyanGFX` se precisar de maior flexibilidade.

Considerações
- Double-buffering para reduzir flicker.
- Palette and color depth conversion for legacy monochrome frames (converter pipeline PNG → RGB565 frames.bin).

Migration steps
1. Implementar `DisplayManager` interface com um driver S3 específico em `drivers/display_t_s3.cpp`.
2. Criar conversor de assets para gerar `frames.bin` em formato compactado.
