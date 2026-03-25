CREATE DATABASE IF NOT EXISTS sistema_multiempresa
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;
USE sistema_multiempresa;

-- =========================
-- TABELA EMPRESAS
-- =========================
CREATE TABLE empresas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    cnpj VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    telefone VARCHAR(20),
    status ENUM('pendente', 'aprovada', 'bloqueada') NOT NULL DEFAULT 'pendente',
    plano_id INT NULL,
    licenca_inicio DATE NULL,
    licenca_fim DATE NULL,
    licenca_status ENUM('ativa', 'vencida', 'suspensa') NOT NULL DEFAULT 'ativa',
    aprovado_em DATETIME NULL,
    aprovado_por INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_empresas_cnpj (cnpj),
    UNIQUE KEY uk_empresas_email (email)
);

CREATE TABLE planos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    descricao VARCHAR(255),
    preco_mensal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    limite_usuarios INT NOT NULL DEFAULT 1,
    limite_clientes INT NOT NULL DEFAULT 0,
    limite_processos INT NOT NULL DEFAULT 0,
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_planos_ativo ON planos(ativo);

-- =========================
-- TABELA USERS
-- =========================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    senha VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'admin',
    empresa_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_users_empresa
    FOREIGN KEY (empresa_id) REFERENCES empresas(id)
    ON DELETE CASCADE,

    UNIQUE KEY uk_users_empresa_email (empresa_id, email)
);

CREATE INDEX idx_users_empresa ON users(empresa_id);

-- =========================
-- TABELA CLIENTES
-- =========================
CREATE TABLE clientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    cpf VARCHAR(20),
    telefone VARCHAR(20),
    whatsapp VARCHAR(20),
    email VARCHAR(100),
    endereco TEXT,
    empresa_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_clientes_empresa
    FOREIGN KEY (empresa_id) REFERENCES empresas(id)
    ON DELETE CASCADE,

    UNIQUE KEY uk_clientes_empresa_cpf (empresa_id, cpf)
);

CREATE INDEX idx_clientes_empresa ON clientes(empresa_id);

-- =========================
-- TABELA PROCESSOS
-- =========================
CREATE TABLE processos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    numero_processo VARCHAR(100) NOT NULL,
    cliente_id INT NOT NULL,
    tipo VARCHAR(100),
    status VARCHAR(50),
    andamento_percentual INT NOT NULL DEFAULT 0,
    andamento_descricao VARCHAR(255),
    custo_processo DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    honorario_escritorio DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    descricao TEXT,
    data_abertura DATE,
    data_ultima_movimentacao DATETIME,
    empresa_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_processos_empresa
    FOREIGN KEY (empresa_id) REFERENCES empresas(id)
    ON DELETE CASCADE,

    CONSTRAINT fk_processo_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
    ON DELETE CASCADE
);

CREATE INDEX idx_processos_empresa ON processos(empresa_id);
CREATE UNIQUE INDEX uk_processos_empresa_numero ON processos(empresa_id, numero_processo);

CREATE TABLE processo_movimentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    processo_id INT NOT NULL,
    empresa_id INT NOT NULL,
    andamento_percentual INT NOT NULL,
    andamento_descricao VARCHAR(255),
    observacao TEXT,
    custo_extra DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_movimentos_processo
    FOREIGN KEY (processo_id) REFERENCES processos(id)
    ON DELETE CASCADE,

    CONSTRAINT fk_movimentos_empresa
    FOREIGN KEY (empresa_id) REFERENCES empresas(id)
    ON DELETE CASCADE
);

CREATE INDEX idx_movimentos_empresa ON processo_movimentos(empresa_id);
CREATE INDEX idx_movimentos_processo ON processo_movimentos(processo_id);

-- =========================
-- DADOS INICIAIS (opcional)
-- =========================
INSERT INTO empresas (nome, cnpj, email, telefone)
VALUES ('Escritório Teste', '00.000.000/0001-00', 'contato@empresa.com', '(22) 99999-9999');

INSERT INTO empresas (nome, cnpj, email, telefone, status, plano_id, licenca_status)
VALUES ('Plataforma', '99.999.999/0001-99', 'admin@sistema.com', '(00) 00000-0000', 'aprovada', NULL, 'ativa');

INSERT INTO planos (nome, descricao, preco_mensal, limite_usuarios, limite_clientes, limite_processos)
VALUES
('Essencial', 'Para escritórios pequenos em fase inicial', 99.90, 3, 200, 100),
('Profissional', 'Mais capacidade e operação diária completa', 199.90, 10, 1000, 500),
('Premium', 'Plano avançado para operação escalável', 399.90, 50, 5000, 2000);

-- usuário inicial (senha: 123456)
INSERT INTO users (nome, email, senha, role, empresa_id)
VALUES ('Admin Plataforma', 'admin@sistema.com', '$2b$10$Bv9LZi62oq5uiFW83UHH9OOYUUvnngG7n8bVKvj/np13NsAKnaaRm', 'platform_admin', 2);

-- cliente exemplo
INSERT INTO clientes (nome, cpf, telefone, email, endereco, empresa_id)
VALUES ('Cliente Teste', '123.456.789-00', '(22) 98888-8888', 'cliente@email.com', 'Rua A, 123', 1);

-- processo exemplo
INSERT INTO processos (numero_processo, cliente_id, tipo, status, descricao, data_abertura, empresa_id)
VALUES ('0001234-56.2024.8.19.0001', 1, 'Civil', 'Em andamento', 'Processo de teste', CURDATE(), 1);
