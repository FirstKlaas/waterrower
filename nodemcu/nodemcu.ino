/*
 Basic WaterRower MQTT Sketch 

 The basic idea is to broadcast metrics from the waterrower sensor
 via an mqtt server. For my experiments I used a Mosquitto mqtt server.

 Of course before uploading this sketch, you have to adopt the settings
 for your wlan as well as the settings for your mqtt server.
  
 @author: Klaas Nebuhr
 @created: 2016-09-25
 
*/
#include "commands.h"
#include "waterrower.h"

/*  You have to adapt the values for the  
 *  ssid and password of course.
 */
const char* ssid     = "FRITZ!Box 6360 Cable";      
const char* password = "4249789363748310";
const char* mqtt_server = "blender";

const byte PIN_MODE_WRITE = 1;
const byte PIN_MODE_READ  = 0;

const byte PIN_STATE_HIGH = 1;
const byte PIN_STATE_LOW  = 0;

#define DEBUG

void setup()
{
  initCommands();
    
  pinMode(LED_BUILTIN, OUTPUT);
  // Setup console
  Serial.begin(115200);
  delay(10);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN,LOW);

  pinMode(ROWER_PIN, INPUT_PULLUP);
  digitalWrite(ROWER_PIN,HIGH);

  startWIFI(ssid, password);
  startClock();
  setupMqtt(mqtt_server);
}


void loop()
{
  digitalWrite(LED_PIN,HIGH);
  sendWaterrowerData();
  delay(10);
  digitalWrite(LED_PIN,LOW);
}



