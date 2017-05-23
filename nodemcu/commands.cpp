#include "commands.h"
#include <stddef.h>
#include <stdlib.h>

const uint8_t CMD_START_SESSION = 1;
const uint8_t CMD_STOP_SESSION  = 2;

void cmdNone(uint8_t* payload, uint16_t length) {
  
}

void cmdStartSession(uint8_t* payload, unsigned int length) {
  setSession(payload[0],payload[1]);
  setUsingFakeDevice(payload[3] == DEVICE_HARDWARE ? false : true); 
  #ifdef DEBUG
  Serial.println("START SESSION");
  #endif
  startMeasuring();  
  #ifdef DEBUG
  Serial.println("SESSION STARTET");  
  #endif
}

void cmdStopSession(uint8_t* payload, unsigned int length) {
  #ifdef DEBUG
  Serial.println("STOP SESSION");  
  #endif
  stopMeasuring();
  setSession(0,0);
  #ifdef DEBUG
  Serial.println("STOPPED SESSION");  
  #endif
}

void initCommands(void) {
  registerCommand(CMD_START_SESSION, (CmdFunction) &cmdStartSession);
  registerCommand(CMD_STOP_SESSION, (CmdFunction) &cmdStopSession);
}



