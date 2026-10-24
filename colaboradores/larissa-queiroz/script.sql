CREATE DATABASE fluxlog;

USE fluxlog;

CREATE TABLE empresa (
id INT PRIMARY KEY AUTO_INCREMENT,
nome_fantasia VARCHAR(70) NOT NULL,
cnpj CHAR(14) NOT NULL,
razao_social VARCHAR(45),
fk_filial INT,
	FOREIGN KEY (fk_filial) REFERENCES empresa(id)
);


-- Tabela usuario com chave composta
CREATE TABLE usuario (
id INT AUTO_INCREMENT,
nome VARCHAR(70),
email VARCHAR(70) UNIQUE,
senha VARCHAR(45) NOT NULL,
tipo_permissao VARCHAR(15) NOT NULL,
fk_empresa INT NOT NULL,

CONSTRAINT pk_usuario
	PRIMARY KEY (id, fk_empresa),

CONSTRAINT fk_usuario_empresa
	FOREIGN KEY (fk_empresa) REFERENCES empresa(id),
    
CONSTRAINT chk_tipo_permissao
	CHECK (tipo_permissao IN ('administrador', 'comum')),
    
CONSTRAINT chk_usuario_empresa_tipo
	CHECK (
    (fk_empresa = 1 AND tipo_permissao = 'administrador')
    OR
    (fk_empresa <> 1 AND tipo_permissao = 'comum')
    )
);


-- Tabela endereço com chave composta
CREATE TABLE endereco (
id INT AUTO_INCREMENT,
logradouro VARCHAR(100),
numero VARCHAR(15),
cep CHAR(8),
fk_empresa INT NOT NULL,

CONSTRAINT pk_endereco
	PRIMARY KEY (id, fk_empresa),

CONSTRAINT fk_endereco_empresa
	FOREIGN KEY (fk_empresa) REFERENCES empresa(id)
);