# include "Ultrasonic.h"

int pinoTrigger = 12;
int pinoEcho = 13;

HC_SR04 sensor(pinoTrigger, pinoEcho);

void setup() {
  Serial.begin(9600);
}

void loop() {
  float distancia = sensor.distance();

  if (distancia > 0 && distancia < 5) {
    Serial.print(1);
  } else {
    Serial.print(0);
  }

  Serial.print(" ");
  Serial.print("Atividade:");
  Serial.println(distancia);

  delay(1000);
}