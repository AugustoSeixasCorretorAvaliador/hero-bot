# HERO.Bot Simulator

Purpose: provide a desktop window that simulates the HERO.Bot display and reacts to HeroEvents produced by HeroOS.

Requirements:
- Render face/animation
- Show current state
- Show event log
- Provide buttons to emit HeroEvents

Implementation notes:
- The simulator uses an IPC bridge (Electron) that publishes/receives HeroEvent-like objects.
- Do not duplicate state logic — the simulator should only render events and expose manual triggers.
