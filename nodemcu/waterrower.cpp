#include "waterrower.h"
/**

Waterrower Write Messages
=========================


  T: /sportshub/waterrower/plain/session
  P: "new" [text]
  D: Resets the session values like max speed and distance

  T: /sportshub/waterrower/plain/session
  P: "pause" [text]
  D: Pauses measuring for the current session or unpauses it. If no session 
     is active, doesn't do anything. 


Waterrower Read Messages
========================
  T: /sportshub/waterrower/plain/speed
  P: Current speed in meter per seconds as text float 

  T: /sportshub/waterrower/plain/maxspeed
  P: Current maximum speed within this session in meter per seconds as text float. If no session is active, returns always 0 

  T: /sportshub/waterrower/plain/distance
  P: Distance within this session. If no session is active, returns always 0 

  T: /sportshub/waterrower/plain/avgspeed
  P: Average speed within the sseion. If no session is active, returns always 0 

  T: /sportshub/waterrower/plain/seconds
  P: Time in seconds, the current session is running. If no session is active, returns always 0 
*/

#define DEBUG

WiFiClient espClient;
PubSubClient client(espClient);

typedef struct Command Command;
typedef Command *CommandPtr;

struct Command {
  uint8_t id;
  CmdFunction func;
  CommandPtr next;
};

CommandPtr head = NULL;

/**
   These are the variables that are modified by the ISR. Therefor they are declared as volatile.
   This ensures that any read to this variables will be done in memory and not on behalf of a
   cached value.
*/
volatile unsigned long tick             =   0;       // Counts the signals coming from the waterrower
volatile unsigned long lasttick         =   0;       // Saves the last tick
volatile unsigned long meter_per_second = 0.0;       // As the name says. Value for meter per second
volatile unsigned long seconds          =   0;       // Seconds the workout is running
volatile float distance                 = 0.0;       // Distance in meters for this workout

unsigned long last_seconds              =   0;       // Which 'seconds' value was send the last time

volatile unsigned long avg_speed_sum    =   0;
volatile unsigned long max_speed        =   0;

/**
   4.805 ticks (interrupts) is equal to one meter distance.
*/
const float ratio = 4.805;

volatile long lastDebounceTime     =  0;      // the last time the output pin was toggled in millis
const unsigned long debounceDelay  = 20;      // Duration in millis to ignore interrupts

// Flag indicating wether we are currently measure things or not.
volatile boolean session_active = false;

byte mac[6];                                  // Buffer for storing the MAC Address.
uint8_t data[16];                             // Waterrower Data Array
                                              // Byte 0-1: Session ID
                                              // Byte 2-5: Distance
char clientid[18];                            // Buffer for the client ID

#ifdef DEBUG
char message[80];                             // Buffer for the message
#endif

const char hex[17] = "0123456789ABCDEF";

void ShowHex(byte convertByte) {
  Serial.print( hex[(convertByte >> 4) & 0x0F]);
  Serial.println( hex[convertByte & 0x0F]);
}
/**
   Wandelt die MAC Adresse des in einen String um.
*/
const char* getClientID() {
  return clientid;
}

void reconnect() {
  // Loop until we're reconnected
  while (!client.connected()) {
#ifdef DEBUG
    Serial.print("Attempting MQTT connection...");
#endif
    // Attempt to connect
    if (client.connect(getClientID())) {
#ifdef DEBUG
      Serial.println("connected");
#endif
      // Once connected, publish an announcement...
      client.publish("/sportshub/device/connect", getClientID());
      // ... and subscribe to a fixed topic
      client.subscribe("/sportshub/waterrower/#");

    } else {
#ifdef DEBUG
      Serial.println("Wifi connection failed. I will try again in 5 seconds");
#endif
      // Wait 5 seconds before retrying
      delay(5000);
    }
  }
}

void startWIFI(const char* ssid, const char* password) {
  uint8_t index = 0;

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
#ifdef DEBUG
    Serial.print(".");
#endif
  }

#ifdef DEBUG
  Serial.println("");
  Serial.println("WiFi connected");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
#endif

  WiFi.macAddress(mac);

  for (uint8_t i = 0; i < 6; i++) {

    clientid[index++] = (char) (hex[(mac[i] >> 4) & 0x0F]);
    clientid[index++] = (char) (hex[(mac[i]) & 0x0F]);
    if (i < 5) {
      clientid[index++] = ':';
    }

  };
  clientid[index] = 0;

  /**
    WiFi.begin(ssid, password);

    #ifdef DEBUG
    if (verbose && WiFi.status() == WL_CONNECTED) {
    Serial.println("");
    Serial.println("WiFi connected");
    }
    #endif
  **/
}

/**
   The ISR that is called every time the waterrower gives a signal.
   "tick" gets incremented each time. A debounce time is used to avoid ticks that come
   frome bounces.
*/
void tick_ISR(void) {
  unsigned long m = millis();
  if (m - lastDebounceTime > debounceDelay) {
    tick++;
    lastDebounceTime = m;
  }
}

void startISR() {
#ifdef DEBUG
  Serial.println("Attaching Rower ISR");
#endif
  attachInterrupt(digitalPinToInterrupt(ROWER_PIN), tick_ISR, FALLING);
}

void stopISR() {
#ifdef DEBUG
  Serial.println("Detaching Rower ISR");
#endif
  detachInterrupt(digitalPinToInterrupt(ROWER_PIN));
}

/**
   Prints the payload of a mqtt message as a string. This of course works
   only, if the payload represnts a string.
*/
void printPayload(byte* payload, unsigned int length) {
  for (int i = 0; i < length; i++) {
    Serial.print((char)payload[i]);
  }
  Serial.println(";");
}

/**
   Printes a binary payload in hexadecimal representation.
*/
void printPayloadHex(byte* payload, unsigned int length) {
  for (int i = 0; i < length; i++) {
    if (payload[i] < 16) Serial.print("0");
    Serial.print(payload[i], HEX);
    Serial.print(" ");
  }
  Serial.println("");
}


/**
   Activates measuring. If not already measuring, this
   also resets internal variables for measurement.
*/
void startSession() {
  if (session_active) return;
  reset();
  session_active = true;
  lastDebounceTime = millis();
  startISR();
}

/**
   Stops the measurement.
   The ISR will be detached, so no more ticks are counted.
   All variables will be resetted.
*/
void stopSession() {
  if (!session_active) return;
  stopISR();
  reset();
  session_active = false;
}

/**
   Sets all variable back to their default value.
   No tickes and no seconds.
*/
void reset() {
  tick = 0;
  lasttick = 0;
  seconds = 0;
  last_seconds = 0;
  distance = 0.0;
  avg_speed_sum = 0;
  max_speed = 0;
  meter_per_second = 0;
}

/**
   This is the callback method for the
   MQTT Server. It gets called, whenever
   the controller receives a message
   from the MQTT server. It gets only messages
   for toppics subscribed to.

   Currently there's only one action. If the
   payload String equals "reset", the measuring
   stops. This was only for testing.
*/
void callback(char* topic, byte* payload, unsigned int length) {
  // handle message arrived
#ifdef DEBUG
  Serial.println("Received mqtt message.");
  Serial.print("Topic: ");
  Serial.println(topic);
  Serial.print("Payload: ");
  printPayloadHex(payload, length);
#endif
  runCommand(payload[0], &payload[1], length - 1);
}

void setupMqtt(const char* server) {
  client.setServer(server, 1883);
  client.setCallback(callback);
  //client.publish("sportshub/device/register", mac, 6);
  //client.publish("sportshub/device/register", clientid);
}


void sendWaterrowerDataPlain(void) {
  unsigned long m_seconds  = getSeconds();
  unsigned long m_tick     = getTicks();
  unsigned long m_avg_speed_sum = avg_speed_sum;
  uint8_t index = 0;
   
  float m_meter_per_second = getMeterPerSecond();

  client.publish("/sportshub/waterrower/plain/speed", )
} 


void sendWaterrowerDataBinary(void) {
  // save the seconds value for this method to avoid race conditions
  unsigned long m_seconds  = getSeconds();
  unsigned long m_tick     = getTicks();
  unsigned long m_avg_speed_sum = avg_speed_sum;
  uint8_t index = 0;
   
  float m_meter_per_second = getMeterPerSecond();

  if (!client.connected()) {
#ifdef DEBUG
    Serial.println("Reconnecting mqtt");
#endif

    reconnect();
  }

  if (client.loop()) {
    if (session_active) { //
#ifdef DEBUG
      //Serial.print(".");
#endif
      if (m_seconds > getLastSeconds()) { //

        unsigned long m_speed    = (unsigned long) (m_meter_per_second);
        unsigned long m_distance = getDistance(m_tick);
        unsigned long m_avg_speed = (unsigned long) (m_avg_speed_sum / m_seconds);
        
        data[index++]  = highByte(m_tick);
        data[index++]  = lowByte(m_tick);
        data[index++]  = highByte(m_seconds);
        data[index++]  = lowByte(m_seconds);
        data[index++]  = highByte(m_speed);
        data[index++]  = lowByte(m_speed);
        data[index++]  = (m_distance >> 24) & 0xff;
        data[index++]  = (m_distance >> 16) & 0xff;
        data[index++]  = (m_distance >> 8) & 0xff;
        data[index++]  = (m_distance) & 0xff;
        data[index++]  = highByte(max_speed);
        data[index++]  = lowByte(max_speed);
        data[index++]  = highByte(m_avg_speed);
        data[index++]  = lowByte(m_avg_speed);

#ifdef DEBUG
        sprintf(message, "%u;%u;%u;%u", m_tick, m_seconds, m_speed, m_distance);
        Serial.println(message);
#endif

        client.publish("sportshub/waterrower/binary/data", data, 14);
        markTime(m_seconds);
      } else {
#ifdef DEBUG
        //Serial.println("Too early to update");
#endif
      }
    } else {
#ifdef DEBUG
      //Serial.println("Not measuring.");
#endif
    }
  } else {
#ifdef DEBUG
    Serial.println("No loop");
#endif
  }
}

/**
   The interrupt service routine (ISR) that is called every second.
   If measuring, then the following variables will be updated.

   seconds, meter_per_second, lasttick
*/
void timer_0_ISR(void) {
  if (session_active) {
    seconds++;
    unsigned long current_tick = tick;
    distance = (float) (current_tick - lasttick);
    meter_per_second = (distance * 100) / ratio;
    if (max_speed < meter_per_second) {
      max_speed = meter_per_second;
    }
    avg_speed_sum += meter_per_second;
    lasttick = current_tick;
  }
  timer0_write(ESP.getCycleCount() + 80000000); //80Mhz -> 80*10^6 = 1 second
}

/**
   Initialiert den Timer 0.
   Jede Sekunde wird die Funktion timer_0_isr() aufgerufen.
*/
void startClock() {
#ifdef DEBUG
  Serial.println("Starting timer0");
#endif
  noInterrupts();
  timer0_isr_init();
  timer0_attachInterrupt(timer_0_ISR);
  timer0_write(ESP.getCycleCount() + 80000000); //80Mhz -> 80*10^6 = 1 second
  interrupts();
}

unsigned long getTicks() {
  return tick;
}

unsigned long getSeconds() {
  return seconds;
}

unsigned long getLastSeconds() {
  return last_seconds;
}

float getMeterPerSecond() {
  return meter_per_second;
}

unsigned long getDistance(unsigned long ticks) {
  return (unsigned long) (ticks * 100 / ratio);
}

void markTime(unsigned long seconds) {
  last_seconds = seconds;
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
    cmd(payload, length);
  }
}

