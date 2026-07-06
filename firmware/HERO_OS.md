# HeroOS (core)

Location: `src/hero_os/`

Components to preserve / stabilize:
- eventbus: HeroEvent, HeroEventBus
- hero_kernel: System
- animation: AnimationEngine
- state: StateMachine
- interfaces: DisplayManager, FrameBuffer, FaceDescriptor

These components implement the platform-agnostic event and state model used by the simulator.
