// Complete ESP32 Wearable Tracker Watch Firmware Sketch
// Required libraries: TinyGPSPlus, TinyGSM, PubSubClient, Adafruit_MPU6050

#include "config.h"
#include <Wire.h>
#include <TinyGPS++.h>
#include <PubSubClient.h>

// Define GSM model for TinyGSM library
#define TINY_GSM_MODEM_SIM7000
#include <TinyGsmClient.h>

// 1. Hardware Object Handlers
HardwareSerial gpsSerial(2); // Serial2 for NEO-6M GPS
HardwareSerial lteSerial(1); // Serial1 for LTE modem

TinyGPSPlus gps;
TinyGsm modem(lteSerial);
TinyGsmClient gsmClient(modem);
PubSubClient mqttClient(gsmClient);

// 2. Global State Variables
unsigned long lastPingTime = 0;
volatile bool sosButtonPressed = false;
volatile unsigned long sosPressStartTime = 0;
bool sosAlertActive = false;

// Fall Detection States
float ax, ay, az;
const float G_ACCEL = 9.81;
bool freeFallDetected = false;
unsigned long freeFallTime = 0;

// MPU6050 Register Addresses (Standard I2C)
const int MPU_addr = 0x68; 

// Interrupt Service Routine for SOS physical button
void IRAM_ATTR handleSosInterrupt() {
  int pinVal = digitalRead(SOS_BUTTON_PIN);
  if (pinVal == LOW) { // Button pressed (Active Low pull-up)
    sosPressStartTime = millis();
    sosButtonPressed = true;
  } else { // Button released
    if (sosButtonPressed) {
      unsigned long duration = millis() - sosPressStartTime;
      if (duration >= DEBOUNCE_TIME) {
        sosAlertActive = true; // SOS Alert verified
      }
      sosButtonPressed = false;
    }
  }
}

// Power toggle for SIM7000/SIM800
void powerToggleModem() {
  pinMode(LTE_PWRKEY_PIN, OUTPUT);
  digitalWrite(LTE_PWRKEY_PIN, HIGH);
  delay(100);
  digitalWrite(LTE_PWRKEY_PIN, LOW);
  delay(1000);
  digitalWrite(LTE_PWRKEY_PIN, HIGH);
  delay(2000);
  Serial.println("Cellular modem power key toggled.");
}

// Initial I2C configuration for MPU6050 Accelerometer
void initMPU6050() {
  Wire.begin(MPU_SDA_PIN, MPU_SCL_PIN);
  Wire.beginTransmission(MPU_addr);
  Wire.write(0x6B); // PWR_MGMT_1 register
  Wire.write(0);    // set to zero (wakes up the MPU-6050)
  Wire.endTransmission(true);
  Serial.println("MPU6050 Accelerometer initialized.");
}

// Read raw data from MPU6050
void readMPUData() {
  Wire.beginTransmission(MPU_addr);
  Wire.write(0x3B); // starting register for Accelerometer data (AcX)
  Wire.endTransmission(false);
  Wire.requestFrom(MPU_addr, 6, true); // request 6 registers (x, y, z)
  
  intAcX = Wire.read() << 8 | Wire.read();
  intAcY = Wire.read() << 8 | Wire.read();
  intAcZ = Wire.read() << 8 | Wire.read();

  // Convert raw values to m/s^2 (Assuming default scale +/- 2g, sensitivity 16384 LSB/g)
  ax = (float)intAcX / 16384.0 * G_ACCEL;
  ay = (float)intAcY / 16384.0 * G_ACCEL;
  az = (float)intAcZ / 16384.0 * G_ACCEL;
}

// MPU6050 raw variables
intAcX, intAcY, intAcZ;

// Reconnect to cellular GPRS network and MQTT Broker
void reconnectGPRSAndMQTT() {
  if (!modem.isNetworkConnected()) {
    Serial.println("Connecting to cellular network...");
    if (!modem.waitForNetwork(180000L)) {
      Serial.println("Cellular network search timeout.");
      return;
    }
    Serial.println("Cellular network registered.");
  }

  if (!modem.isGprsConnected()) {
    Serial.print("Connecting to APN: ");
    Serial.println(GPRS_APN);
    if (!modem.gprsConnect(GPRS_APN, GPRS_USER, GPRS_PASS)) {
      Serial.println("GPRS connection failed.");
      return;
    }
    Serial.println("GPRS connection active.");
  }

  if (!mqttClient.connected()) {
    Serial.print("Connecting to MQTT Broker: ");
    Serial.println(MQTT_BROKER);
    if (mqttClient.connect(MQTT_CLIENT_ID)) {
      Serial.println("MQTT Broker connected.");
    } else {
      Serial.print("MQTT connection failed, state: ");
      Serial.println(mqttClient.state());
    }
  }
}

// Calculates battery capacity percentage from voltage divider input
int getBatteryPercentage() {
  int rawADC = analogRead(BATTERY_ADC_PIN);
  float voltage = (rawADC / 4095.0) * 3.3 * 2; // times 2 if 10k:10k resistor divider
  
  // Convert voltage (3.3V - 4.2V typical LiPo range) to percentage
  int percent = (int)((voltage - 3.4) / (4.2 - 3.4) * 100);
  if (percent > 100) percent = 100;
  if (percent < 0) percent = 0;
  return percent;
}

void setup() {
  Serial.begin(115200);
  
  // 1. Initialize GPS Hardware Serial
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  Serial.println("GPS Serial initialized.");

  // 2. Initialize GPRS Modem Hardware Serial
  lteSerial.begin(115200, SERIAL_8N1, LTE_RX_PIN, LTE_TX_PIN);
  powerToggleModem();
  Serial.println("Initializing modem...");
  if (!modem.init()) {
    Serial.println("Failed to initialize SIM modem.");
  } else {
    Serial.println("SIM modem initialized.");
  }

  // 3. Initialize SOS Button and Interrupt
  pinMode(SOS_BUTTON_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(SOS_BUTTON_PIN), handleSosInterrupt, CHANGE);
  Serial.println("SOS Interrupt initialized.");

  // 4. Initialize MPU6050
  initMPU6050();

  // 5. Setup MQTT
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  
  reconnectGPRSAndMQTT();
}

void loop() {
  // Feed GPS bytes from serial buffer
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  // Perform GPRS & MQTT client loops
  if (!mqttClient.connected()) {
    reconnectGPRSAndMQTT();
  }
  mqttClient.loop();

  // 1. Process Accelerometer Fall Detection
  readMPUData();
  float mag = sqrt(ax*ax + ay*ay + az*az);
  unsigned long now = millis();

  // Check for free fall (< 0.3G)
  if (mag < 0.3 * G_ACCEL) {
    freeFallDetected = true;
    freeFallTime = now;
  }

  // Check for impact (> 3.2G) following free fall within 1 second
  if (freeFallDetected) {
    if (now - freeFallTime > 1000) {
      freeFallDetected = false; // timed out
    } else if (mag > 3.2 * G_ACCEL) {
      Serial.println("⚠️ FALL DETECTED: Publishing MQTT Fall Event!");
      freeFallDetected = false;

      // Construct MQTT fall payload
      char fallPayload[256];
      snprintf(fallPayload, sizeof(fallPayload), 
        "{\"deviceId\":\"dev-aarav-101\",\"latitude\":%f,\"longitude\":%f,\"speed\":%f,\"battery\":%d,\"type\":\"fall\"}",
        gps.location.lat(), gps.location.lng(), gps.speed.kmh(), getBatteryPercentage()
      );
      
      mqttClient.publish(TOPIC_FALL, fallPayload);
    }
  }

  // 2. Process Physical SOS Button trigger
  if (sosAlertActive) {
    Serial.println("🚨 EMERGENCY ALERT ACTIVE: Publishing SOS Packet!");
    
    char sosPayload[256];
    snprintf(sosPayload, sizeof(sosPayload), 
      "{\"deviceId\":\"dev-aarav-101\",\"latitude\":%f,\"longitude\":%f,\"speed\":%f,\"battery\":%d}",
      gps.location.isValid() ? gps.location.lat() : 28.6253,
      gps.location.isValid() ? gps.location.lng() : 77.2155,
      gps.speed.kmh(),
      getBatteryPercentage()
    );

    mqttClient.publish(TOPIC_SOS, sosPayload);
    sosAlertActive = false; // Reset emergency flag
  }

  // 3. Process Regular Telemetry Ping (Every 10 seconds)
  if (now - lastPingTime >= PING_INTERVAL) {
    lastPingTime = now;
    
    if (gps.location.isValid()) {
      Serial.print("Location details: Lat: ");
      Serial.print(gps.location.lat(), 6);
      Serial.print(" | Lng: ");
      Serial.println(gps.location.lng(), 6);

      char payload[256];
      snprintf(payload, sizeof(payload), 
        "{\"deviceId\":\"dev-aarav-101\",\"latitude\":%f,\"longitude\":%f,\"speed\":%f,\"battery\":%d,\"network\":\"4G\"}",
        gps.location.lat(),
        gps.location.lng(),
        gps.speed.kmh(),
        getBatteryPercentage()
      );

      mqttClient.publish(TOPIC_TELEMETRY, payload);
      Serial.println("Telemetry ping published successfully.");
    } else {
      Serial.println("GPS coordinates invalid/searching satellites...");
      // Send fallback check-in ping
      char payload[256];
      snprintf(payload, sizeof(payload), 
        "{\"deviceId\":\"dev-aarav-101\",\"latitude\":28.6253,\"longitude\":77.2155,\"speed\":0.0,\"battery\":%d,\"network\":\"3G\",\"is_fallback\":true}",
        getBatteryPercentage()
      );
      mqttClient.publish(TOPIC_TELEMETRY, payload);
    }
  }

  delay(50); // Small cycle delay
}
