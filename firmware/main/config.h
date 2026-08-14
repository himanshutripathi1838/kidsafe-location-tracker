// ESP32 Hardware Pins & Network Configurations for Wearable Tracker Watch

#ifndef CONFIG_H
#define CONFIG_H

// 1. Hardware Pin Definitions (ESP32 DevKit V1)
#define GPS_RX_PIN 16     // NEO-6M TX connected to ESP32 RX2 (GPIO16)
#define GPS_TX_PIN 17     // NEO-6M RX connected to ESP32 TX2 (GPIO17)

#define LTE_RX_PIN 26     // SIM7000/SIM800 TX connected to ESP32 GPIO26
#define LTE_TX_PIN 27     // SIM7000/SIM800 RX connected to ESP32 GPIO27
#define LTE_PWRKEY_PIN 4  // Power key pin to bootstrap LTE module

#define SOS_BUTTON_PIN 15 // Physical SOS button (Pull-Up, active low)

#define MPU_SDA_PIN 21    // I2C Data SDA
#define MPU_SCL_PIN 22    // I2C Clock SCL

#define BATTERY_ADC_PIN 34 // Analog Pin to read battery voltage divider

// 2. Cellular GPRS Network Configurations
// Replace APN details with your SIM provider's credentials (e.g., Airtel, Jio, VI)
#define GPRS_APN      "airtelgprs.com"
#define GPRS_USER     ""
#define GPRS_PASS     ""

// 3. MQTT Broker Settings
#define MQTT_BROKER   "broker.hivemq.com" // Public MQTT broker for testing
#define MQTT_PORT     1883
#define MQTT_CLIENT_ID "ESP32_Kids_Tracker_01"

// MQTT Publish Topics
#define TOPIC_TELEMETRY "kids/tracker/dev-aarav-101/telemetry"
#define TOPIC_SOS       "kids/tracker/dev-aarav-101/sos"
#define TOPIC_FALL      "kids/tracker/dev-aarav-101/fall"

// 4. Configuration Thresholds
#define PING_INTERVAL   10000 // In milliseconds (10 second location ping interval)
#define DEBOUNCE_TIME   3000  // Debounce time for SOS long-press (3 seconds)

#endif // CONFIG_H
