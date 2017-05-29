#ifndef commands_h
#define commands_h


#include "waterrower.h"
#include <stdint.h>

const uint8_t DEVICE_HARDWARE        = 0;
const uint8_t DEVICE_FAKE_WATERROWER = 1;


void initCommands(void);
#endif
