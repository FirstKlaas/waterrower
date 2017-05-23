#ifndef commands_h
#define commands_h


#include "waterrower.h"
#include <stdint.h>

const uint8_t DEVICE_HARDWARE        = 0;
const uint8_t DEVICE_FAKE_WATERROWER = 1;


/**
void cmdNonecmdNone(uint8_t* payload, uint16_t length);

void cmdStartSession(uint8_t* payload, uint16_t length);

void cmdStopSession(uint8_t* payload, uint16_t length);
**/
void initCommands(void);
#endif
