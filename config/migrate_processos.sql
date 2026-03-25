USE sistema_multiempresa;

ALTER TABLE processos
    ADD COLUMN IF NOT EXISTS andamento_percentual INT NOT NULL DEFAULT 0 AFTER status,
    ADD COLUMN IF NOT EXISTS andamento_descricao VARCHAR(255) NULL AFTER andamento_percentual,
    ADD COLUMN IF NOT EXISTS custo_processo DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER andamento_descricao,
    ADD COLUMN IF NOT EXISTS honorario_escritorio DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER custo_processo,
    ADD COLUMN IF NOT EXISTS data_ultima_movimentacao DATETIME NULL AFTER data_abertura;

CREATE TABLE IF NOT EXISTS processo_movimentos (
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
