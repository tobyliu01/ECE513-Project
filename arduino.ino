#include "arduino_secrets.h"

#undef LED_RED
#include <Wire.h>
#include <WiFiS3.h>
#include <ArduinoHttpClient.h>
#include "RTC.h"
#include "Arduino_LED_Matrix.h"

#include <MAX30105.h>
#include <spo2_algorithm.h>
#include <WiFiUdp.h>
#include <NTPClient.h>

WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", -25200, 3600); 



// WiFi configuration
char ssid[] = "Xiaomi 15S Pro";
char pass[] = "12345678";

const char* serverUrl = "54.177.57.86";
const int   serverPort = 3000;
const char* apiPath    = "/api/measurements";
const char* apiKey     = "a-different-long-random-string-for-your-device-123456789";
const char* deviceIds[] = {
  "1234 5678",  
  "5678 1234"    
};
const int NUM_DEVICES = 2;
int currentDeviceIndex = 0;   // 0 â deviceIds[0], 1 â deviceIds[1]

// Measuring Time & Period
const int MEASUREMENT_INTERVAL_MINUTES = 30;
const int START_HOUR = 6;
const int END_HOUR   = 22;
const unsigned long REQUEST_TIMEOUT_MS = 300000;

// State Machine
enum State { STATE_IDLE, STATE_REQUESTING, STATE_MEASURING };
State currentState = STATE_IDLE;

// Global Object
MAX30105 particleSensor;
WiFiClient client;
HttpClient httpClient(client, serverUrl, serverPort);
ArduinoLEDMatrix matrix;

// MAX30105 Buffer
const int SPO2_BUFF_SIZE = 100;
uint32_t irBuffer[SPO2_BUFF_SIZE];
uint32_t redBuffer[SPO2_BUFF_SIZE];
int bufferIndex = 0;

// Timing
unsigned long stateStartTime = 0;
unsigned long lastMeasurementTime = 0;
bool isFirstRun = true;

// LED ICON
const uint32_t icon_heart[] = {0x3184a444, 0x42081100, 0xa0040000};
const uint32_t icon_check[] = {0x00010020, 0x04008000, 0x00000000};
const uint32_t icon_cross[] = {0x88114422, 0x22441188, 0x00000000};

// Offline Queue
struct OfflineData {
  int32_t hr;
  int32_t spo2;
  unsigned long timestamp;
  uint8_t deviceIndex;
};

const int MAX_OFFLINE_DATA = 20;
OfflineData offlineQueue[MAX_OFFLINE_DATA];
int queueHead  = 0;
int queueTail  = 0;
int queueCount = 0;

const unsigned long MAX_OFFLINE_SECS = 24UL * 3600UL;


// Debugging output
void printOfflineQueue() {
  Serial.println("Offline Queue (Test)");

  if (queueCount == 0) {
    Serial.println("((Empty))");
    return;
  }

  int index = queueHead;
  for (int i = 0; i < queueCount; i++) {
    OfflineData d = offlineQueue[index];

    Serial.print(i);
    Serial.print(") HR=");
    Serial.print(d.hr);
    Serial.print(" | SpO2=");
    Serial.print(d.spo2);
    Serial.print(" | ts=");
    Serial.print(d.timestamp);
    Serial.print(" | devIdx=");
    Serial.print(d.deviceIndex);

    unsigned long now = getCurrentTimestamp();
    Serial.print(" | age=");
    Serial.print(now - d.timestamp);
    Serial.println(" sec");

    index = (index + 1) % MAX_OFFLINE_DATA;
  }
  Serial.println("=============================");
}

void showIcon(const uint32_t icon[], int times = 3, int speed = 200) {
  for (int i = 0; i < times; i++) {
    matrix.loadFrame(icon);
    delay(speed);
    matrix.clear();
    delay(speed);
  }
}

// Time
unsigned long getCurrentTimestamp() {
  RTCTime t;
  RTC.getTime(t);
  return t.getUnixTime();
}

bool isTimeAllowed() {
  static unsigned long lastPrint = 0;   
  bool allowPrint = false;

  if (millis() - lastPrint > 10000) {
    lastPrint = millis();
    allowPrint = true;
  }

  int hour = -1;

  if (WiFi.status() == WL_CONNECTED) {
    if (timeClient.update()) {
      unsigned long epoch = timeClient.getEpochTime();
      hour = (epoch % 86400UL) / 3600;

      if (allowPrint) {
        Serial.print("[TimeCheck NTP] epoch=");
        Serial.print(epoch);
        Serial.print(" localHour=");
        Serial.println(hour);
      }
    }
  }

  if (hour == -1) {
    RTCTime t;
    RTC.getTime(t);
    hour = t.getHour();

    if (allowPrint) {
      Serial.print("[TimeCheck RTC] hour=");
      Serial.println(hour);
    }
  }

  return (hour >= START_HOUR && hour < END_HOUR);
}



// Offline save
void saveOffline(int32_t hr, int32_t spo2) {
  unsigned long now = getCurrentTimestamp();

  // Delete all expired data
  while (queueCount > 0) {
    OfflineData &d = offlineQueue[queueHead];
    if (now - d.timestamp > MAX_OFFLINE_SECS) {
      Serial.println("Delete expired offline data (over 24 hours)");
      queueHead = (queueHead + 1) % MAX_OFFLINE_DATA;
      queueCount--;
    } else {
      break;
    }
  }

  if (queueCount < MAX_OFFLINE_DATA) {
    offlineQueue[queueTail].hr        = hr;
    offlineQueue[queueTail].spo2      = spo2;
    offlineQueue[queueTail].timestamp = now;
    offlineQueue[queueTail].deviceIndex = currentDeviceIndex;

    queueTail = (queueTail + 1) % MAX_OFFLINE_DATA;
    queueCount++;

    Serial.println("The data has been stored in the offline queue.");
  } else {
    Serial.println("The offline queue is full (there are too many data that have not expired)");
  }

  printOfflineQueue();
}


// Upload
bool sendData(const char* deviceId, int32_t hr, int32_t spo2) {
  if (WiFi.status() != WL_CONNECTED) return false;

  String jsonData = "{";
  jsonData += "\"heartRate\":" + String(hr) + ",";
  jsonData += "\"spo2\":" + String(spo2) + ",";
  jsonData += "\"deviceId\":\"" + String(deviceId) + "\"";
  jsonData += "}";

  Serial.print("Upload[");
  Serial.print(deviceId);
  Serial.print("]: ");
  Serial.println(jsonData);

  httpClient.beginRequest();
  httpClient.post(apiPath);
  httpClient.sendHeader("Content-Type", "application/json");
  httpClient.sendHeader("Content-Length", jsonData.length());
  httpClient.sendHeader("x-api-key", apiKey);
  httpClient.beginBody();
  httpClient.print(jsonData);
  httpClient.endRequest();

  int statusCode = httpClient.responseStatusCode();
  Serial.print("Status Code: ");
  Serial.println(statusCode);
  httpClient.responseBody();

  return (statusCode == 200 || statusCode == 201);
}


// Offline supplementary
void processOfflineQueue() {
  if (queueCount == 0) return;
  if (WiFi.status() != WL_CONNECTED) return;

  Serial.println("Uploading offline data...");
  printOfflineQueue();

  OfflineData &d = offlineQueue[queueHead];
  const char* devId = deviceIds[0];
  if (d.deviceIndex < NUM_DEVICES) {
    devId = deviceIds[d.deviceIndex];
  }
  if (sendData(devId, d.hr, d.spo2)) {
    Serial.println("Upload successful");
    queueHead = (queueHead + 1) % MAX_OFFLINE_DATA;
    queueCount--;
  } else {
    Serial.println("Upload failed. Try again later.");
  }
}


// MAX30105 Setup
void setupSensorStable() {
  Serial.println("Setup MAX30105...");

  Wire.begin();

  if (!particleSensor.begin(Wire)) {
    Serial.println("MAX30105 Not found. Please check the wiring!");
    while (1);
  }

  Serial.println("MAX30105 Connected");

  particleSensor.setup(60, 4, 2, 100, 411, 4096);
  particleSensor.setPulseAmplitudeRed(0x1F);
  particleSensor.setPulseAmplitudeIR(0x1F);
  particleSensor.setPulseAmplitudeGreen(0);

  Serial.println("MAX30105 Configuration completed\n");
}

void syncTimeFromNTP() {
  if (WiFi.status() != WL_CONNECTED) return;

  Serial.println("The time is being synchronized from NTP....");
  timeClient.begin();

  for (int i = 0; i < 10; i++) {
    if (timeClient.update()) {
      unsigned long epoch = timeClient.getEpochTime(); 
      RTCTime current(epoch);
      RTC.setTime(current);

      Serial.print("NTP synchronization successfulï¼epoch=");
      Serial.println(epoch);
      return;
    }
    delay(500);
  }

  Serial.println("NTP synchronization failed. Using the original time from the RTC.");
}

// SETUP
void setup() {
  Serial.begin(115200);
  matrix.begin();
  RTC.begin();
  Serial.print("Connection WiFi: ");
  while (WiFi.status() != WL_CONNECTED) {
    WiFi.begin(ssid, pass);
    delay(2000);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected");

  

  
  syncTimeFromNTP();

  setupSensorStable();

  
}

// LOOP

void loop() {
  unsigned long now = millis();

  // Try to make it again every 10 seconds.
  static unsigned long lastRetryTime = 0;
  if (now - lastRetryTime > 10000) {
    processOfflineQueue();
    lastRetryTime = now;
  }

  // Test output (per 1s)
  static unsigned long lastDebug = 0;
  if (now - lastDebug > 1000) {
    Serial.print("[Test] Status: ");
    Serial.print((currentState == STATE_IDLE) ? "IDLE" :
                 (currentState == STATE_REQUESTING) ? "REQUESTING" : "measuring");
    Serial.print(" | IR=");
    Serial.print(particleSensor.getIR());
    Serial.print(" | Progress=");
    Serial.println(bufferIndex);
    lastDebug = now;
  }

  // State Machine
  switch (currentState) {

    // IDLE
    case STATE_IDLE: {
      // First run: Measure once regardless of the availability of time.
      if (isFirstRun) {
        isFirstRun = false;
        Serial.println("On the first run, it directly enters the request state...");
        currentState = STATE_REQUESTING;
        stateStartTime = now;
        break;
      }

      // The time is not in 6 to 22: it is paused in idle mode.
      if (!isTimeAllowed()) {
        Serial.println("The current time is not available for measurement (only from 6:00 to 22:00). Please wait...");
        delay(2000);
        break;
      }

      // Has it been more than the set interval since the last measurement?
      if (now - lastMeasurementTime >
          (unsigned long)MEASUREMENT_INTERVAL_MINUTES * 60000UL) {
        Serial.println("Time's up! Enter the request state....");
        currentState = STATE_REQUESTING;
        stateStartTime = now;
      }
      break;
    }

    // Request status: Waiting for fingers
    case STATE_REQUESTING: {

      if ((now / 400) % 2 == 0)
        matrix.loadFrame(icon_heart);
      else
        matrix.clear();

      if (now - stateStartTime > REQUEST_TIMEOUT_MS) {
        Serial.println("Request timeout, returning to idle state");
        matrix.clear();
        lastMeasurementTime = now;
        currentState = STATE_IDLE;
        break;
      }

      if (particleSensor.getIR() > 20000) {
        Serial.println("Finger detected! Measurement started....");
        matrix.clear();
        bufferIndex = 0;
        currentState = STATE_MEASURING;
        stateStartTime = now;
      }
      break;
    }

    case STATE_MEASURING: {

      if (now - stateStartTime > 15000) {
        Serial.println("Measurement timeout (possibly due to finger shaking), return to request state");
        bufferIndex = 0;
        currentState = STATE_REQUESTING;
        break;
      }

      if (particleSensor.check()) {
        if (particleSensor.available()) {

          uint32_t ir  = particleSensor.getFIFOIR();
          uint32_t red = particleSensor.getFIFORed();
          particleSensor.nextSample();

          if (ir < 8000) {
            Serial.println("Remove the finger, interrupt the measurement, and return to the request state.");
            bufferIndex   = 0;
            currentState  = STATE_REQUESTING;
            break;
          }

          irBuffer[bufferIndex]  = ir;
          redBuffer[bufferIndex] = red;
          bufferIndex++;

          if (bufferIndex % 10 == 0) {
            Serial.print("Progress: ");
            Serial.print(bufferIndex);
            Serial.print("/");
            Serial.println(SPO2_BUFF_SIZE);
          }

          if (bufferIndex >= SPO2_BUFF_SIZE) {
            Serial.println("\n>>> Data collection is complete. Calculation begins....");

            int32_t spo2_val, hr_val;
            int8_t spo2_valid, hr_valid;

            maxim_heart_rate_and_oxygen_saturation(
              irBuffer, SPO2_BUFF_SIZE,
              redBuffer,
              &spo2_val, &spo2_valid,
              &hr_val, &hr_valid
            );

            if (hr_valid && spo2_valid) {
              Serial.print("HR = ");
              Serial.print(hr_val);
              Serial.print(" | SpO2 = ");
              Serial.println(spo2_val);

              const char* currentDevId = deviceIds[currentDeviceIndex];

              if (sendData(currentDevId, hr_val, spo2_val)) {
                Serial.println("Upload successfulï¼");
                showIcon(icon_check, 3);
              } else {
                Serial.println("Upload failed. Saved to offline queue.");
                saveOffline(hr_val, spo2_val);
                showIcon(icon_cross, 3);
              }

              currentDeviceIndex = (currentDeviceIndex + 1) % NUM_DEVICES;


              lastMeasurementTime = millis();
              currentState        = STATE_IDLE;
              bufferIndex         = 0;
              matrix.clear();
            } else {
              Serial.println("Data is invalid (finger unstable). Re-measure....");
              showIcon(icon_cross, 1);
              bufferIndex   = 0;
              stateStartTime = millis(); 
            }
          }  // end if buffer full
        }
      }
      break;
    }

  } // end switch
}



