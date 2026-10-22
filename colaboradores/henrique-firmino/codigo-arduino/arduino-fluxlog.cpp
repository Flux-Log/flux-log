#include "Ultrasonic.h"

int pinoTrigger = 12;
int pinoEcho = 13;

HC_SR04 sensor(pinoTrigger, pinoEcho);

void setup() {
  Serial.begin(9600);
}

void loop() {
  float distancia = sensor.distance();

  if (distancia > 0 && distancia < 5) {
    Serial.println(1);
  } else {
    Serial.println(0);
  }

  delay(1000);
}