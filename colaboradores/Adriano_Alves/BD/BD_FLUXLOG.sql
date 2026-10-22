CREATE DATABASE fluxlog;
USE fluxlog;


CREATE TABLE empresa (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nome_fantasia VARCHAR(70),
  cnpj CHAR(14)
  
);

CREATE TABLE usuario (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(70) UNIQUE,
  senha VARCHAR(45),
  fk_empresa INT NOT NULL,
FOREIGN KEY (fk_empresa) REFERENCES empresa(id)
  );


CREATE TABLE setor (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nome VARCHAR(70),
  descricao VARCHAR(255),
  ativo TINYINT,
  fk_usuario INT NOT NULL,
FOREIGN KEY (fk_usuario) REFERENCES usuario(id)
);

CREATE TABLE sensor (
  id INT PRIMARY KEY AUTO_INCREMENT,
  status_sensor VARCHAR(20),
  data_instalacao DATE,
  data_manutencao DATETIME,
  fk_setor INT NOT NULL,
FOREIGN KEY (fk_setor) REFERENCES setor(id)
);

CREATE TABLE evento (
  id INT PRIMARY KEY AUTO_INCREMENT,
   sensor_digital TINYINT,
  nome_sensor VARCHAR(50),
  data_hora_inicio DATETIME,
  data_hora_fim DATETIME,
  duracao_segundos INT,
  classificacao VARCHAR(20),
  tempo_excedido_segundos INT,
  status_evento VARCHAR(20),
  fk_sensor INT,
  FOREIGN KEY (fk_sensor) REFERENCES sensor(id)
);

CREATE TABLE localidade_sensor (
id INT PRIMARY KEY AUTO_INCREMENT,
rua VARCHAR(60),
numero INT,
fk_sensor INT,
FOREIGN KEY (fk_sensor) REFERENCES sensor (id)
);