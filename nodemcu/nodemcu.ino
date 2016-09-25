/*S
 Basic MQTT example 
 
  - connects to an MQTT server
  - publishes "hello world" to the topic "outTopic"
  - subscribes to the topic "inTopic"
*/
#include <ESP8266WiFi.h>
#include <PubSubClient.h>

const char* ssid     = "xxxxxxxxx";
const char* password = "xxxxxxxxxxxxxx";

const int ROWER_PIN = 4;

volatile unsigned long tick = 0;
volatile unsigned long lasttick = 0;
volatile float meter_per_second = 0.0;
volatile unsigned long seconds = 0;
const float ratio = 4.805;

volatile long lastDebounceTime = 0;  // the last time the output pin was toggled
const unsigned long debounceDelay = 20;
const float STOP_SPEED = 0.1;
volatile unsigned long last_stop_time;
const unsigned long minimal_downtime = 1000;
volatile boolean measuring_running = false;
volatile boolean send_zero_values = true;
 
char message[20];

// Update these with values suitable for your network.
IPAddress server(192, 168, 1, 115);
PubSubClient client(server);



boolean is_measuring() {
  return measuring_running; 
}

void start_measuring() {
  measuring_running = true;
  reset();
  //Serial.println("Start Measurement");
}

void stop_measuring() {
  measuring_running = false;
  send_zero_values = true;
  meter_per_second = 0.0;
  last_stop_time = millis();
  //reset();
  //Serial.println("Stop Measurement");
  //client.publish("/waterrower/data","0;0;0;0");
}

void callback(const MQTT::Publish& pub) {
  // handle message arrived
  String s = pub.payload_string();
  if (s.equals("reset")) {
    stop_measuring();  
  }
}

void setup()
{
  pinMode(LED_BUILTIN, OUTPUT);
  last_stop_time = millis();
  // Setup console
  Serial.begin(115200);
  delay(10);
  //Serial.println();
  //Serial.println();
  
  lastDebounceTime = millis();
  pinMode(ROWER_PIN, INPUT_PULLUP);
  digitalWrite(ROWER_PIN,HIGH);
  attachInterrupt(ROWER_PIN, tick_ISR, FALLING);

  client.set_callback(callback);  

  WiFi.begin(ssid, password);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected");  
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
  WiFi.begin(ssid, password);

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("");
    Serial.println("WiFi connected");
  }

  if (client.connect("waterrower")) {
    client.subscribe("/waterrower/cmd");
  }

  noInterrupts();
  timer0_isr_init();
  timer0_attachInterrupt(timer_0_ISR);
  timer0_write(ESP.getCycleCount() + 80000000); //80Mhz -> 80*10^6 = 1 second
  interrupts();
}


void reconnect() {
  // Loop until we're reconnected
  while (!client.connected()) {
    //Serial.print("Attempting MQTT connection...");
    // Attempt to connect
    if (client.connect("arduinoClient")) {
      //Serial.println("connected");
      // Once connected, publish an announcement...
      client.subscribe("/waterrower/cmd");
    } else {
      //Serial.print("failed, rc=");
      //Serial.println(" try again in 5 seconds");
      // Wait 5 seconds before retrying
      delay(5000);
    }
  }
}

void loop()
{
  if (!client.connected()) {
    reconnect();
  }
  if (client.loop()) {
    if (is_measuring() || send_zero_values) {
      unsigned long now = millis();
      digitalWrite(LED_BUILTIN, HIGH);
      sprintf(message,"%u;%u;%u;%u",tick, seconds, (unsigned long) (meter_per_second * 100), (unsigned long) (tick*100/ratio));
      client.publish("/waterrower/data",message);
      Serial.print("Time to Publish : ");
      Serial.println(millis()-now);
      digitalWrite(LED_BUILTIN, LOW);
      send_zero_values = false;
    }
  }
  delay(100);
}

void reset() {
    tick = 0;
    lasttick = 0;
    seconds = 0;  
}

void timer_0_ISR(void) {
  if (is_measuring()) {
    seconds++;
    unsigned long current_tick = tick;
    meter_per_second = (current_tick - lasttick) / ratio;
    lasttick = current_tick;
    if (meter_per_second < STOP_SPEED) {
      stop_measuring();
    }
  }
  timer0_write(ESP.getCycleCount() + 80000000); //80Mhz -> 80*10^6 = 1 second
}

void tick_ISR(void) {
  unsigned long m = millis();
  if (!is_measuring() && (m - last_stop_time >= minimal_downtime)) {
    start_measuring();  
  } else {
    unsigned long m = millis();
    if (m - lastDebounceTime > debounceDelay) {
      tick++;  
    }
  }
  lastDebounceTime = m;
}

