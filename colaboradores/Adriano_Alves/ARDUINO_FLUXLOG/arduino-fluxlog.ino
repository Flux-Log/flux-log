#include "Ultrasonic.h"

int pinoTrigger = 2;
int pinoEcho = 3;

HC_SR04 sensor(pinoTrigger, pinoEcho);

void setup() {
  Serial.begin(9600);
}

void loop() {
  float distancia = sensor.distance();

  if (distancia > 0 && distancia < 15) {
    Serial.println(1);
  } else {
    Serial.println(0);
  }

  delay(1000);
}