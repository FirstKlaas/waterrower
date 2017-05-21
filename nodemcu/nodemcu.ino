/*
 Basic WaterRower MQTT Sketch 

 The basic idea is to broadcast metrics from the waterrower sensor
 via an mqtt server. For my experiments I used a Mosquitto mqtt server.

 Of course before uploading this sketch, you have to adopt the settings
 for your wlan as well as the settings for your mqtt server.
  
 @author: Klaas Nebuhr
 @created: 2016-09-25
 
*/
#include <ESP8266WiFi.h>
#include <PubSubClient.h>

/*  You have to adapt the values for the  
 *  ssid and password of course.
 */
const char* ssid     = "FRITZ!Box 6360 Cable";      
const char* password = "4249789363748310";
const char* mqtt_server = "nebuhr";

const int ROWER_PIN = 4;
const int LED_PIN   = 5;

byte PIN_MODE_WRITE = 1;
byte PIN_MODE_READ  = 0;

byte PIN_STATE_HIGH = 1;
byte PIN_STATE_LOW  = 0;

volatile unsigned long tick     = 0;
volatile unsigned long lasttick = 0;
volatile float meter_per_second = 0.0;
volatile unsigned long seconds  = 0;

unsigned long last_seconds = 0;              // Which 'seconds' value was send the last time

const byte CMD_START_SESSION = 1;
const byte CMD_STOP_SESSION  = 2;

const byte DEVICE_HARDWARE        = 0;
const byte DEVICE_FAKE_WATERROWER = 1;

boolean using_fake_waterrower = false;



byte sessionid_low  = 0;                      // Session ID we got from the server (Low Byte)
byte sessionid_high = 0;                      // Session ID we got from the server (High Byte)


/**
 * 4.805 ticks (interrupts) is equal to one meter distance.
 */
const float ratio = 4.805;

volatile long lastDebounceTime = 0;           // the last time the output pin was toggled in millis
const unsigned long debounceDelay = 20;       // Duration in millis to ignore interrupts
                                              // slower than STOP_SPEED before a new session can start.
volatile boolean measuring_running = false;

char message[80];                             // Buffer for the message
byte mac[6];

uint8_t data[10];

/** 
 * Update these with values suitable for your network. 
 *  192.168.178.78
 */
WiFiClient espClient; 
PubSubClient client(espClient);

/*
 * true if measuring currently is running, false else.
 * If not measuring, no values will be published to 
 * the mqtt server.
 */
inline boolean is_measuring() {
  return measuring_running; 
}

/**
 * Activates measuring. If not already measuring, this 
 * also resets internal variables for measurement.
 */
inline void startMeasuring() {
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
  Serial.println("Received mqtt message.");
  Serial.print("Topic: ");
  Serial.println(topic);
  Serial.print("Payload: ");
  printPayloadHex(payload, length);

  switch (payload[0]) {
    case CMD_START_SESSION:
      sessionid_high = payload[1];
      sessionid_low  = payload[2];
      using_fake_waterrower =  (payload[3] == DEVICE_HARDWARE ? false : true); 
      Serial.println("START SESSION");
      startMeasuring();
      
      break;
    case CMD_STOP_SESSION:
      Serial.println("STOP SESSION");
      stopMeasuring();
      break;
  }
  
  if (strcmp("sportshub/session",topic) == 0) {
    if (strcmp("start",(char*) payload) == 0) {
      startMeasuring();
    } else if (strcmp("stop", (char*) payload) == 0) {     
      stopMeasuring();
    } else {
      Serial.println("Unknown session command");    
    }
  } else if (strcmp("pin",topic) == 0) {
    Serial.print("Pin ");
    printPayload(payload, length);
    
    if (payload[0] == PIN_MODE_WRITE) {
      digitalWrite(payload[1], payload[2] == PIN_STATE_HIGH ? HIGH : LOW);
    }
     
  }
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

void startISR() {
  attachInterrupt(digitalPinToInterrupt(ROWER_PIN), tick_ISR, FALLING);
}

void stopISR() {
  detachInterrupt(digitalPinToInterrupt(ROWER_PIN));  
}

void setupMqtt() {
  client.setServer(mqtt_server, 1883);
  client.setCallback(callback);  
}

/**
 * Wandelt die MAC Adresse des in einen String um.
 */
String getClientID() {
  String s = String();
  for (int i=0; i<6; i++) { 
    if (mac[i] < 16) s += '0';
    s += String(mac[i],HEX);
    if (i < 5) s += String(':');
  };
  return s;
}

void startWIFI(boolean verbose) {
  WiFi.begin(ssid, password);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    if (verbose) {
      Serial.print(".");
    };
  }

  if (verbose) {
    Serial.println("");
    Serial.println("WiFi connected");  
    Serial.println("IP address: ");
    Serial.println(WiFi.localIP());
    WiFi.macAddress(mac);
  };
  WiFi.begin(ssid, password);

  if (verbose && WiFi.status() == WL_CONNECTED) {
    Serial.println("");
    Serial.println("WiFi connected");
  }
}

void setup()
{
  pinMode(LED_BUILTIN, OUTPUT);
  // Setup console
  Serial.begin(115200);
  delay(10);
  //Serial.println();
  //Serial.println();
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN,HIGH);

  
  
  pinMode(ROWER_PIN, INPUT_PULLUP);
  digitalWrite(ROWER_PIN,HIGH);

  startWIFI(true);
  startClock();
  setupMqtt();
  //startMeasuring();
}

void reconnect() {
  // Loop until we're reconnected
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    // Attempt to connect
    if (client.connect(getClientID().c_str())) {
      Serial.println("connected");
      // Once connected, publish an announcement...
      client.publish("sportshub","Waterrower connected");
      client.publish("sportshub/device/connect",getClientID().c_str());
      
      String topic = String();
      topic += getClientID();
      topic += "/#";
      client.subscribe(topic.c_str());
      
    } else {
      Serial.print("failed, rc=");
      Serial.println(" try again in 5 seconds");
      // Wait 5 seconds before retrying
      delay(5000);
    }
  }
}

void loop()
{
  // save the seconds value for this method to avoid race conditions
  unsigned long m_seconds = seconds;
  unsigned long m_tick = tick;
  float m_meter_per_second = meter_per_second; 
  
  if (!client.connected()) {
    reconnect();
  }
  
  //Serial.print(" m/s: "); Serial.println(m_meter_per_second);
    
  if (client.loop()) {
    if (is_measuring()) { //
      if (m_seconds > last_seconds) { //
        if (using_fake_waterrower) {
          m_meter_per_second = random(100);
          m_tick = random(32000);
        }
        unsigned long m_speed    = (unsigned long) (m_meter_per_second * 100);
        unsigned long m_distance = (unsigned long) (m_tick*100/ratio);

        data[0] = sessionid_high;
        data[1] = sessionid_low;
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
        client.publish("sportshub/da  ta",data, 10);
        last_seconds = m_seconds;
      }
    }
  }
  delay(10);
}

void timer_0_ISR(void) {
  if (is_measuring()) {
    seconds++;    
    unsigned long current_tick = tick;
    float distance = (float) (current_tick - lasttick);
    meter_per_second = distance / ratio;
    lasttick = current_tick;
  }
  timer0_write(ESP.getCycleCount() + 80000000); //80Mhz -> 80*10^6 = 1 second
}

void tick_ISR(void) {
  digitalWrite(LED_BUILTIN, HIGH);
  unsigned long m = millis();
  if (m - lastDebounceTime > debounceDelay) {
    tick++;  
  }
  lastDebounceTime = m;
  digitalWrite(LED_BUILTIN, LOW);
}

