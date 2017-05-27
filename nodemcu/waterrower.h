#ifndef WATERROWER_H
#define WATERROWER_H

#include <ESP8266WiFi.h>
#include <PubSubClient.h>

#include <stddef.h>
#include <stdlib.h>

enum LEVEL {
  DEBUG,
  INFO,
  WARN,
  FATAL
};

typedef void (* CmdFunction) (uint8_t* payload, uint16_t length);

void registerCommand(uint8_t id, CmdFunction func);

CmdFunction getCommand(uint8_t id);

void runCommand(uint8_t id, uint8_t* payload, unsigned int length);

uint8_t sizeCommand();

void logToSportshub(LEVEL lvl, const char* message);

const int ROWER_PIN = 4;
const int LED_PIN   = 5;

boolean is_measuring();

void startMeasuring();

void stopMeasuring();

void reset();

void setSession(uint8_t high,uint8_t low);

uint8_t getSessionHigh();

uint8_t getSessionLow();

boolean isUsingFakeDevice(void);

void setUsingFakeDevice(boolean val);

const char* getClientID();

void startWIFI(const char* ssid, const char* password);

void setupMqtt(const char* server);

void sendWaterrowerData(void);

void reconnect();

void startClock();

unsigned long getSeconds();

unsigned long getLastSeconds();

unsigned long getTicks();

float getMeterPerSecond();

void markTime(unsigned long seconds);

unsigned long getDistance(unsigned long ticks);

#endif
