CREATE DATABASE fluxlogAtualizado;

USE fluxlogAtualizado;

CREATE TABLE empresa (
idEmpresa INT PRIMARY KEY AUTO_INCREMENT,
nomeEmpresa VARCHAR (60) NOT NULL,
cnpj CHAR (14) UNIQUE NOT NULL
);

CREATE TABLE usuario(
idUsuario INT PRIMARY KEY AUTO_INCREMENT,
nome VARCHAR(60),
cpf CHAR(11) UNIQUE NOT NULL,
email VARCHAR(100) UNIQUE,
senha VARCHAR (50) NOT NULL,
fk_empresa INT, 
CONSTRAINT chEmpresa FOREIGN KEY (fk_empresa) REFERENCES empresa (idEmpresa)
);

CREATE TABLE sensor(
idSensor INT PRIMARY KEY AUTO_INCREMENT,
dataInstalacao DATETIME,
status VARCHAR (15) NOT NULL CONSTRAINT chStatus CHECK (status IN ('Ativo', 'Inativo', 'Manutenção')),
setor INT NOT NULL,
fk_empresa INT, 
CONSTRAINT chSensorEmpresa FOREIGN KEY (fk_empresa) REFERENCES empresa (idEmpresa)
);

CREATE TABLE movimentacao (
idMovimentacao INT PRIMARY KEY AUTO_INCREMENT,
data_Movimento_Inicio DATETIME,
data_Movimento_Final DATETIME,
fk_sensor INT, 
CONSTRAINT chSensor FOREIGN KEY (fk_sensor) REFERENCES sensor(idSensor)
);

