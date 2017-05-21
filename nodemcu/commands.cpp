#include "commands.h"
#include <stddef.h>
#include <stdlib.h>

CommandPtr head = NULL;

void registerCommand(uint8_t id, CmdFunction func) {
  CommandPtr cmd = (CommandPtr) malloc(sizeof(Command));
  cmd->id   = id;
  cmd->func = func;
  cmd->next = NULL;
  
  if (head != NULL) {
    cmd->next = head;
  }
  head = cmd;
}

CmdFunction getCommand(uint8_t id) {
  CommandPtr cursor = head;
  while (cursor != NULL) {
    if (cursor->id == id) return cursor->func;
    cursor = cursor->next;  
  }
  return NULL;
}

void runCommand(uint8_t id, uint8_t* payload, unsigned int length) {
  CmdFunction cmd = getCommand(id);
  if (cmd != NULL) {
    cmd(payload,length);
  }
}

