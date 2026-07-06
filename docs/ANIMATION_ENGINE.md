# ANIMATION_ENGINE — design and integration

Objetivo: uma engine de animações desacoplada que carrega dados de LittleFS e executa frames via `DisplayManager`.

Componentes
- `AnimationRepository` — gerencia metadados e disponibilidade (LittleFS index `animations.json`).
- `AnimationLoader` — carrega frames e metadados (JSON) em memória ou stream.
- `AnimationScheduler` — agenda reproduções, prioridades, repetições.
- `AnimationPlayer` — consome frames, aplica timing (fps), envia para `DisplayManager`.

Formato de animação (exemplo)

animations/<id>/meta.json

{
  "id":"focus",
  "frames": "frames.bin",
  "width":128,
  "height":64,
  "frameCount":20,
  "fps":12,
  "loop":true,
  "priority":10,
  "triggers":["THINKING","PLAY_ANIMATION"]
}

Performance
- Stream frames from LittleFS; evitar carregar frames inteiros na heap quando possível.

APIs
- `play(id, options)` — returns `PlaybackHandle`.
- `stop(handle)`
- `setPriority(handle, p)`
