#include "waterrower.h"
/** 
 */
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
 * These are the variables that are modified by the ISR. Therefor they are declared as volatile.
 * This ensures that any read to this variables will be done in memory and not on behalf of a
 * cached value.
 */
volatile unsigned long tick     = 0;         // Counts the signals coming from the waterrower
volatile unsigned long lasttick = 0;         // Saves the last tick
volatile float meter_per_second = 0.0;       // As the name says. Value for meter per second
volatile unsigned long seconds  = 0;         // Seconds the workout is running
volatile float distance         = 0.0;       // Distance in meters for this workout              

unsigned long last_seconds = 0;              // Which 'seconds' value was send the last time

/**
 * 4.805 ticks (interrupts) is equal to one meter distance.
 */
const float ratio = 4.805;

volatile long lastDebounceTime = 0;           // the last time the output pin was toggled in millis
const unsigned long debounceDelay = 20;       // Duration in millis to ignore interrupts
                                              // slower than STOP_SPEED before a new session can start.
volatile boolean measuring_running = false;

char message[80];                             // Buffer for the message
byte mac[6];                                  // Buffer for storing the MAC Address.

char clientid[18];

uint8_t sessionid_low  = 0;                      // Session ID we got from the server (Low Byte)
uint8_t sessionid_high = 0;                      // Session ID we got from the server (High Byte)

boolean using_fake_waterrower = true;

void setSession(uint8_t high,uint8_t low) {
  sessionid_high = high;
  sessionid_low  = low;
}

boolean isUsingFakeDevice(void) {
  return using_fake_waterrower;
}

void setUsingFakeDevice(boolean val) {
  using_fake_waterrower = val;
}

uint8_t getSessionHigh() {
  return sessionid_high;
}

uint8_t getSessionLow() {
  return sessionid_low;
}


/*
 * true if measuring currently is running, false else.
 * If not measuring, no values will be published to 
 * the mqtt server.
 */
boolean is_measuring() {
  return measuring_running; 
}


/**
 * Wandelt die MAC Adresse des in einen String um.
 */
const char* getClientID() {
  uint8_t index = 0;
  for (uint8_t i=0; i<6; i++) { 
    if (mac[i] < 16) {
      clientid[index++] = '0';
    }
    clientid[index++] = '1';
    if (i < 5) {
      clientid[index++] = ':';
    }
    
  };
  clientid[index] = 0;
  return clientid;
}

void reconnect() {
  // Loop until we're reconnected
  while (!getMqttClient().connected()) {
    #ifdef DEBUG
    Serial.print("Attempting MQTT connection...");
    #endif
    // Attempt to connect
    if (getMqttClient().connect(getClientID())) {
      #ifdef DEBUG
      Serial.println("connected");
      #endif
      // Once connected, publish an announcement...
      getMqttClient().publish("sportshub","Waterrower connected");
      getMqttClient().publish("sportshub/device/connect",getClientID());
      
      String topic = String();
      topic += getClientID();
      topic += "/#";
      getMqttClient().subscribe(topic.c_str());
      
    } else {
      #ifdef DEBUG
      Serial.print("failed, rc=");
      Serial.println(" try again in 5 seconds");
      #endif
      // Wait 5 seconds before retrying
      delay(5000);
    }
  }
}

void startWIFI(const char* ssid, const char* password) {
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
 * The ISR that is called every time the waterrower gives a signal.
 * Ticke is updated. A debounce time is used to avoid ticks that come
 * frome bounces.
 */
void tick_ISR(void) {
  digitalWrite(LED_BUILTIN, HIGH);
  unsigned long m = millis();
  if (m - lastDebounceTime > debounceDelay) {
    tick++;  
  }
  lastDebounceTime = m;
  digitalWrite(LED_BUILTIN, LOW);
}

void startISR() {
  attachInterrupt(digitalPinToInterrupt(ROWER_PIN), tick_ISR, FALLING);
}

void stopISR() {
  detachInterrupt(digitalPinToInterrupt(ROWER_PIN));  
}


/**
 * Activates measuring. If not already measuring, this 
 * also resets internal variables for measurement.
 */
void startMeasuring() {
  reset();
  measuring_running = true;
  lastDebounceTime = millis();
  startISR();
}

/**
 * Stops the measurement.
 * The ISR will be detached, so no more ticks are counted.
 * All variables will be resetted.
 */
void stopMeasuring() {
  stopISR();
  reset();
  measuring_running = false;
  meter_per_second = 0.0;
}

/**
 * Sets all variable back to their default value.
 * No tickes and no seconds.
 */
void reset() {
  tick = 0;
  lasttick = 0;
  seconds = 0;  
  last_seconds = 0;
  distance = 0.0;
}

/**
 * This is the callback method for the
 * MQTT Server. It gets called, whenever
 * the controller receives a message
 * from the MQTT server. It gets only messages
 * for toppics subscribed to.
 * 
 * Currently there's only one action. If the 
 * payload String equals "reset", the measuring
 * stops. This was only for testing.
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
  runCommand(payload[0],&payload[1], length-1);
}

/**
 * Prints the payload of a mqtt message as a string. This of course works
 * only, if the payload represnts a string.
 */
void printPayload(byte* payload, unsigned int length) {
  for (int i = 0; i < length; i++) {
    Serial.print((char)payload[i]);
  }
  Serial.println(";");
}

/**
 * Printes a binary payload in hexadecimal representation. 
 */
void printPayloadHex(byte* payload, unsigned int length) {
  for (int i = 0; i < length; i++) {
    if (payload[i] < 16) Serial.print("0"); 
    Serial.print(payload[i],HEX);
    Serial.print(" ");
  }
  Serial.println("");
}

void setupMqtt(const char* server) {
  client.setServer(server, 1883);
  client.setCallback(callback);  
}

PubSubClient getMqttClient() {
  return client;
}

/**
 * The interrupt service routine (ISR) that is called every second. 
 * If measuring, then the following variables will be updated.
 * 
 * seconds, meter_per_second, lasttick
 */
void timer_0_ISR(void) {
  if (is_measuring()) {
    seconds++;    
    unsigned long current_tick = tick;
    distance = (float) (current_tick - lasttick);
    meter_per_second = distance / ratio;
    lasttick = current_tick;
  }
  timer0_write(ESP.getCycleCount() + 80000000); //80Mhz -> 80*10^6 = 1 second
}

/**
 * Initialiert den Timer 0. 
 * Jede Sekunde wird die Funktion timer_0_isr() aufgerufen.
 */
void startClock() {
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
    cmd(payload,length);
  }
}

