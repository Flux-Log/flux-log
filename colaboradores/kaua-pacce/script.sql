CREATE DATABASE logistica;
USE logistica;

CREATE TABLE empresa (
id INT PRIMARY KEY AUTO_INCREMENT,
cnpj CHAR(14) NOT NULL UNIQUE,
nome VARCHAR(45) NOT NULL,
telefone CHAR(9) NOT NULL UNIQUE
);

CREATE TABLE usuario (
id INT PRIMARY KEY AUTO_INCREMENT,
cpf CHAR(11) NOT NULL UNIQUE,
nome VARCHAR(45) NOT NULL,
senha VARCHAR(25) NOT NULL,
email VARCHAR(100) NOT NULL UNIQUE,
fk_empresa_usuario INT,
CONSTRAINT fk_empresa_usuario FOREIGN KEY (fk_empresa_usuario) REFERENCES empresa(id)
);

CREATE TABLE sensor (
id INT PRIMARY KEY AUTO_INCREMENT,
setor INT NOT NULL,
status_sensor VARCHAR(20) NOT NULL,
CONSTRAINT ch_status_sensor CHECK(status_sensor IN('EM MANUTENÇÃO', 'ATIVO', 'INATIVO')),
dt_instalacao DATE NOT NULL,
dt_manutencao DATETIME,
fk_empresa_sensor INT NOT NULL,
CONSTRAINT fk_empresa_sensor FOREIGN KEY (fk_empresa_sensor) REFERENCES empresa(id)
);

CREATE TABLE movimentacao (
id INT PRIMARY KEY AUTO_INCREMENT,
horario DATETIME NOT NULL,
fk_sensor INT NOT NULL,
CONSTRAINT fk_sensor FOREIGN KEY (fk_sensor) REFERENCES sensor(id)
);