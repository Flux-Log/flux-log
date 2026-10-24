#include <Ultrasonic.h>

int pinoTrigger = 12;
int pinoEcho = 13;

Ultrasonic sensor(pinoTrigger, pinoEcho);

void setup() {
  Serial.begin(9600);
}

void loop() {
  float distancia = sensor.read();

  if (distancia > 0 && distancia < 5) {
    Serial.println(1);
  } else {
    Serial.println(0);
  }

  Serial.print(" ");
  Serial.print("Atividade:");
  Serial.println(distancia);

  delay(1000);
} // <- O loop só deve ser fechado AQUI, no final de tudo.