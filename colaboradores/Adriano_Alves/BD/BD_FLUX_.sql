CREATE DATABASE fluxlog;
USE fluxlog;

CREATE TABLE empresa (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nome_fantasia VARCHAR(70),
  cnpj CHAR(14),
  razao_social VARCHAR(45),
  fk_filial INT,
  FOREIGN KEY (fk_filial) REFERENCES empresa(id)
);

CREATE TABLE endereco (
  id INT PRIMARY KEY AUTO_INCREMENT,
  logradouro VARCHAR(100),
  cep CHAR(8),
  fk_empresa INT NOT NULL,
  FOREIGN KEY (fk_empresa) REFERENCES empresa(id)
);

CREATE TABLE usuario (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nome VARCHAR(70),
  email VARCHAR(70) UNIQUE,
  senha VARCHAR(45),
  tipo_usuario VARCHAR(45),
  fk_empresa INT NOT NULL,
  FOREIGN KEY (fk_empresa) REFERENCES empresa(id)
);

CREATE TABLE setor (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nome VARCHAR(70),
  descricao VARCHAR(255),
  tempo_atencao_segundos INT,
  tempo_prolongado_segundos INT,
  ativo TINYINT DEFAULT 1,
  fk_empresa INT NOT NULL,
  FOREIGN KEY (fk_empresa) REFERENCES empresa(id)
);

CREATE TABLE sensor (
  id INT PRIMARY KEY AUTO_INCREMENT,
  status_sensor VARCHAR(20),
  data_instalacao DATE,
  data_manutencao DATETIME,
  fk_setor INT NOT NULL,
  FOREIGN KEY (fk_setor) REFERENCES setor(id)
);

CREATE TABLE localidade_sensor (
  id INT PRIMARY KEY AUTO_INCREMENT,
  rua VARCHAR(60),
  numero INT,
  fk_sensor INT NOT NULL,
  FOREIGN KEY (fk_sensor) REFERENCES sensor(id)
);

CREATE TABLE evento (
  id INT PRIMARY KEY AUTO_INCREMENT,
  data_hora_inicio DATETIME,
  data_hora_fim DATETIME,
  duracao_segundos INT,
  classificacao VARCHAR(20),
  tempo_excedido_segundos INT,
  status_evento VARCHAR(20),
  fk_sensor INT NOT NULL,
  FOREIGN KEY (fk_sensor) REFERENCES sensor(id)
);

INSERT INTO empresa (nome_fantasia, cnpj, razao_social, fk_filial) VALUES
('Assaí Atacadão - Matriz', '06057223000171', 'Sendas Distribuidora S/A', NULL),
('Assaí Atacadão - São Paulo', '06057223000252', 'Sendas Distribuidora S/A', 1),
('Assaí Atacadão - Morumbi', '06057223000333', 'Sendas Distribuidora S/A', 1);

INSERT INTO setor (nome, descricao, fk_empresa) VALUES
('Bebidas', 'Setor de bebidas gerais', 1),
('Alimentos', 'Setor de alimentos não perecíveis', 1),
('Limpeza', 'Setor de produtos de limpeza', 1);

INSERT INTO setor (nome, descricao, fk_empresa) VALUES
('Bebidas', 'Setor de bebidas gerais', 2),
('Alimentos', 'Setor de alimentos não perecíveis', 2),
('Limpeza', 'Setor de produtos de limpeza', 2);

INSERT INTO setor (nome, descricao, fk_empresa) VALUES
('Bebidas', 'Setor de bebidas gerais', 3),
('Alimentos', 'Setor de alimentos não perecíveis', 3),
('Limpeza', 'Setor de produtos de limpeza', 3);

INSERT INTO sensor (id, status_sensor, data_instalacao, fk_setor) VALUES
(1, 'ATIVO', CURDATE(), 1),
(2, 'ATIVO', CURDATE(), 2),
(3, 'ATIVO', CURDATE(), 3);

INSERT INTO sensor (id, status_sensor, data_instalacao, fk_setor) VALUES
(4, 'ATIVO', CURDATE(), 4),
(5, 'ATIVO', CURDATE(), 5),
(6, 'ATIVO', CURDATE(), 6);

INSERT INTO sensor (id, status_sensor, data_instalacao, fk_setor) VALUES
(7, 'ATIVO', CURDATE(), 7),
(8, 'ATIVO', CURDATE(), 8),
(9, 'ATIVO', CURDATE(), 9);

