#ifndef commands_h
#define commands_h

#include <stdint.h>

typedef void (* CmdFunction) (uint8_t* payload, unsigned int length);

typedef struct Command Command;
typedef Command *CommandPtr;

struct Command {
  uint8_t id;
  CmdFunction func;
  CommandPtr next;
};

void registerCommand(uint8_t id, CmdFunction func);

CmdFunction getCommand(uint8_t id);

void runCommand(uint8_t id, uint8_t* payload, unsigned int length);

#endif
