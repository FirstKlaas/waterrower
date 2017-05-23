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

uint8_t data[10];                             // Don't know what this variable was for.

#define DEBUG

void setup()
{
  initCommands();
    
  pinMode(LED_BUILTIN, OUTPUT);
  // Setup console
  Serial.begin(115200);
  delay(10);
  //Serial.println();
  //Serial.println();
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN,LOW);

  
  
  pinMode(ROWER_PIN, INPUT_PULLUP);
  digitalWrite(ROWER_PIN,HIGH);

  startWIFI(ssid, password);
  startClock();
  setupMqtt(mqtt_server);
  //startMeasuring();
}


void loop()
{
  // save the seconds value for this method to avoid race conditions
  unsigned long m_seconds  = getSeconds();
  unsigned long m_tick     = getTicks();
  float m_meter_per_second = getMeterPerSecond(); 
  
  if (!getMqttClient().connected()) {
    reconnect();
  }
  
  if (getMqttClient().loop()) {
    if (is_measuring()) { //
      if (m_seconds > getLastSeconds()) { //
        if (isUsingFakeDevice()) {
          m_meter_per_second = random(100);
          m_tick = random(32000);
        }
        unsigned long m_speed    = (unsigned long) (m_meter_per_second * 100);
        unsigned long m_distance = getDistance(m_tick);

        data[0] = getSessionHigh();
        data[1] = getSessionLow();
        data[2] = highByte(m_tick);
        data[3] = lowByte(m_tick);
        data[4] = highByte(m_seconds);
        data[5] = lowByte(m_seconds);
        data[6] = highByte(m_speed);
        data[7] = lowByte(m_speed);
        data[8] = highByte(m_distance);
        data[9] = lowByte(m_distance);
        
        
        //sprintf(message,"%u;%u;%u;%u",m_tick, m_seconds, m_speed, (unsigned long) (m_tick*100/ratio));
        //Serial.println(message);
        digitalWrite(LED_PIN,HIGH);
        getMqttClient().publish("sportshub/data",data, 10);
        markTime(m_seconds);
        digitalWrite(LED_PIN,LOW);
      }
    }
  }
  delay(10);
}



