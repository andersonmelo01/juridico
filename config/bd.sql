-- =========================
-- CRIAÇÃO DO BANCO (opcional)
-- =========================
CREATE DATABASE IF NOT EXISTS sistema_multiempresa;
USE sistema_multiempresa;

-- =========================
-- TABELA EMPRESAS
-- =========================
CREATE TABLE empresas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    cnpj VARCHAR(20),
    email VARCHAR(100),
    telefone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- TABELA USERS
-- =========================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100),
    email VARCHAR(100),
    senha VARCHAR(255),
    empresa_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_users_empresa
    FOREIGN KEY (empresa_id) REFERENCES empresas(id)
    ON DELETE CASCADE
);

CREATE INDEX idx_users_empresa ON users(empresa_id);

-- =========================
-- TABELA CLIENTES
-- =========================
CREATE TABLE clientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100),
    cpf VARCHAR(20),
    telefone VARCHAR(20),
    email VARCHAR(100),
    endereco TEXT,
    empresa_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_clientes_empresa
    FOREIGN KEY (empresa_id) REFERENCES empresas(id)
    ON DELETE CASCADE,

    UNIQUE (empresa_id, cpf)
);

CREATE INDEX idx_clientes_empresa ON clientes(empresa_id);

-- =========================
-- TABELA PROCESSOS
-- =========================
CREATE TABLE processos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    numero_processo VARCHAR(100),
    cliente_id INT,
    tipo VARCHAR(100),
    status VARCHAR(50),
    descricao TEXT,
    data_abertura DATE,
    empresa_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_processos_empresa
    FOREIGN KEY (empresa_id) REFERENCES empresas(id)
    ON DELETE CASCADE,

    CONSTRAINT fk_processo_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
    ON DELETE CASCADE
);

CREATE INDEX idx_processos_empresa ON processos(empresa_id);

-- =========================
-- DADOS INICIAIS (opcional)
-- =========================
INSERT INTO empresas (nome, cnpj, email, telefone)
VALUES ('Empresa Teste', '00.000.000/0001-00', 'contato@empresa.com', '(22) 99999-9999');

-- usuário inicial (senha fictícia)
INSERT INTO users (nome, email, senha, empresa_id)
VALUES ('Admin', 'admin@empresa.com', '123456', 1);

-- cliente exemplo
INSERT INTO clientes (nome, cpf, telefone, email, endereco, empresa_id)
VALUES ('Cliente Teste', '123.456.789-00', '(22) 98888-8888', 'cliente@email.com', 'Rua A, 123', 1);

-- processo exemplo
INSERT INTO processos (numero_processo, cliente_id, tipo, status, descricao, data_abertura, empresa_id)
VALUES ('0001234-56.2024.8.19.0001', 1, 'Civil', 'Em andamento', 'Processo de teste', CURDATE(), 1);
