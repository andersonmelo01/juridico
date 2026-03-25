USE sistema_multiempresa;

ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS status ENUM('pendente', 'aprovada', 'bloqueada') NOT NULL DEFAULT 'pendente',
    ADD COLUMN IF NOT EXISTS plano_id INT NULL,
    ADD COLUMN IF NOT EXISTS licenca_inicio DATE NULL,
    ADD COLUMN IF NOT EXISTS licenca_fim DATE NULL,
    ADD COLUMN IF NOT EXISTS licenca_status ENUM('ativa', 'vencida', 'suspensa') NOT NULL DEFAULT 'ativa',
    ADD COLUMN IF NOT EXISTS aprovado_em DATETIME NULL,
    ADD COLUMN IF NOT EXISTS aprovado_por INT NULL;

CREATE TABLE IF NOT EXISTS planos (
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

INSERT IGNORE INTO empresas (id, nome, cnpj, email, telefone, status, plano_id)
VALUES (2, 'Plataforma', '99.999.999/0001-99', 'admin@sistema.com', '(00) 00000-0000', 'aprovada', NULL);

INSERT IGNORE INTO planos (id, nome, descricao, preco_mensal, limite_usuarios, limite_clientes, limite_processos)
VALUES
(1, 'Essencial', 'Para escritórios pequenos em fase inicial', 99.90, 3, 200, 100),
(2, 'Profissional', 'Mais capacidade e operação diária completa', 199.90, 10, 1000, 500),
(3, 'Premium', 'Plano avançado para operação escalável', 399.90, 50, 5000, 2000);

INSERT IGNORE INTO users (nome, email, senha, role, empresa_id)
VALUES ('Admin Plataforma', 'admin@sistema.com', '$2b$10$Bv9LZi62oq5uiFW83UHH9OOYUUvnngG7n8bVKvj/np13NsAKnaaRm', 'platform_admin', 2);
