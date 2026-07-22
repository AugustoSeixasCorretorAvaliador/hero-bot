@echo off
title HERO.Bot AutoStart
set "HERO_LAUNCHER=E:\Main HEROIA 2026 UNIF\hero.bot\firmware\simulator\Start-HERO-Bot-Simulator.ps1"

if not exist "%HERO_LAUNCHER%" exit /b 1

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%HERO_LAUNCHER%"
exit /b %errorlevel%
