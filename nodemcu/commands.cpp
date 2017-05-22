#include "commands.h"
#include <stddef.h>
#include <stdlib.h>

CommandPtr head = NULL;


void cmdNone(uint8_t* payload, uint16_t length) {
  
}

void registerCommand(uint8_t id, CmdFunction func) {
  if (getCommand(id) != NULL) return;
   
  CommandPtr cmd = (CommandPtr) malloc(sizeof(Command));
  cmd->id   = id;
  cmd->func = func;
  cmd->next = NULL;
  
  if (head != NULL) {
    cmd->next = head;
  }
  head = cmd;
  return;
}

CmdFunction getCommand(uint8_t id) {
  CommandPtr cursor = head;
  while (cursor != NULL) {
    if (cursor->id == id) return cursor->func;
    cursor = cursor->next;  
  }
  return NULL;
}

uint8_t sizeCommand() {
  CommandPtr cursor = head;
  uint8_t size = 0;
  while (cursor != NULL) {
    size++;
    cursor = cursor->next;  
  }
  return size;
  
}

void runCommand(uint8_t id, uint8_t* payload, unsigned int length) {
  CmdFunction cmd = getCommand(id);
  if (cmd != NULL) {
    cmd(payload,length);
  }
}

