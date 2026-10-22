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

USE fluxlog;

-- 1. EMPRESA
INSERT INTO empresa (nome_fantasia, cnpj)
VALUES ('Mercado FluxLog', '12345678000199');

-- 2. USUARIO
INSERT INTO usuario (email, senha, fk_empresa)
VALUES ('admin@fluxlog.com', '12345', 1);

-- 3. SETORES
INSERT INTO setor (nome, descricao, ativo, fk_usuario)
VALUES
('Limpeza', 'Setor de produtos de limpeza', 1, 1),
('Arroz', 'Setor de arroz e graos', 1, 1),
('Pet', 'Setor de produtos para animais', 1, 1),
('Bebidas', 'Setor de bebidas', 1, 1);

-- 4. SENSORES: 2 POR SETOR
INSERT INTO sensor (status_sensor, data_instalacao, fk_setor)
VALUES
('Ativo', CURDATE(), 1),
('Ativo', CURDATE(), 1),
('Ativo', CURDATE(), 2),
('Ativo', CURDATE(), 2),
('Ativo', CURDATE(), 3),
('Ativo', CURDATE(), 3),
('Ativo', CURDATE(), 4),
('Ativo', CURDATE(), 4);

-- 5. LOCALIDADE DOS SENSORES
INSERT INTO localidade_sensor (rua, numero, fk_sensor)
VALUES
('Rua da Limpeza', 1, 1),
('Rua da Limpeza', 2, 2),
('Rua do Arroz', 1, 3),
('Rua do Arroz', 2, 4),
('Rua do Pet', 1, 5),
('Rua do Pet', 2, 6),
('Rua das Bebidas', 1, 7),
('Rua das Bebidas', 2, 8);


INSERT INTO setor (nome, descricao, ativo, fk_usuario)
VALUES
('Limpeza', 'Setor de produtos de limpeza', 1, 1),
('Arroz', 'Setor de arroz e grãos', 1, 1),
('Pet', 'Setor de produtos para animais', 1, 1),
('Bebidas', 'Setor de bebidas', 1, 1);

USE fluxlog;

INSERT INTO sensor (status_sensor, data_instalacao, fk_setor)
VALUES
('Ativo', CURDATE(), 5),
('Ativo', CURDATE(), 5),
('Ativo', CURDATE(), 6),
('Ativo', CURDATE(), 6),
('Ativo', CURDATE(), 7),
('Ativo', CURDATE(), 7),
('Ativo', CURDATE(), 8),
('Ativo', CURDATE(), 8);

select * from sensor;
SELECT sensor.id AS id_sensor, setor.nome AS setor
FROM sensor
JOIN setor ON sensor.fk_setor = setor.id
WHERE sensor.id BETWEEN 17 AND 24
ORDER BY sensor.id;
