#pragma once

// HERO.Bot board profile for LILYGO T-Display-S3 V1.3.
// Based on the official LILYGO TFT_eSPI Setup206 configuration.

#include <stdint.h>

// Prevent TFT_eSPI from loading its bundled User_Setup.h. This file is the
// single source of truth for the display controller, bus and pins.
#define USER_SETUP_LOADED
#define USER_SETUP_ID 206

#define USE_HSPI_PORT
#define ST7789_DRIVER
#define INIT_SEQUENCE_3
#define CGRAM_OFFSET
#define TFT_RGB_ORDER TFT_RGB
#define TFT_INVERSION_ON
#define TFT_PARALLEL_8_BIT

// Native panel geometry. Rotation 1 exposes a 320 x 170 logical canvas.
#define TFT_WIDTH 170
#define TFT_HEIGHT 320

#define TFT_CS 6
#define TFT_DC 7
#define TFT_RST 5
#define TFT_WR 8
#define TFT_RD 9

#define TFT_D0 39
#define TFT_D1 40
#define TFT_D2 41
#define TFT_D3 42
#define TFT_D4 45
#define TFT_D5 46
#define TFT_D6 47
#define TFT_D7 48

#define TFT_BL 38
#define TFT_BACKLIGHT_ON 1

#define LOAD_GLCD
#define LOAD_FONT2
#define LOAD_FONT4

#ifdef __cplusplus

constexpr uint8_t HERO_DISPLAY_ROTATION = 1;
constexpr uint16_t HERO_DISPLAY_LOGICAL_WIDTH = 320;
constexpr uint16_t HERO_DISPLAY_LOGICAL_HEIGHT = 170;

constexpr uint8_t HERO_BOARD_POWER_PIN = 15;
constexpr uint8_t HERO_DISPLAY_BACKLIGHT_PIN = TFT_BL;
constexpr uint8_t HERO_DISPLAY_BACKLIGHT_ON = 1;

constexpr uint8_t HERO_BUTTON_1_PIN = 0;
constexpr uint8_t HERO_BUTTON_2_PIN = 14;
constexpr uint8_t HERO_BATTERY_VOLTAGE_PIN = 4;
constexpr uint8_t HERO_TOUCH_I2C_SCL_PIN = 17;
constexpr uint8_t HERO_TOUCH_I2C_SDA_PIN = 18;
constexpr uint8_t HERO_TOUCH_INTERRUPT_PIN = 16;
constexpr uint8_t HERO_TOUCH_RESET_PIN = 21;

#endif
