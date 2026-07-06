# HERO.Bot Architecture (overview)

This document summarizes the intended architecture for HERO.Bot.

High level:

Chrome/HERO.IA (future)
  ↓
HeroEventBus (event protocol)
  ↓
HeroOS (core: eventbus, state machine, animation engine)
  ↓
Display Driver / Simulator

Goals:
- Keep HeroOS core isolated under `src/hero_os/`.
- Provide simulator bridge that publishes/consumes the same HeroEvent protocol.
- Keep hardware drivers isolated so simulator can replace them.
