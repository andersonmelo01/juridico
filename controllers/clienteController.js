const db = require('../config/database');

function validarLimiteClientes(empresaId, callback) {
    const sql = `
        SELECT p.limite_clientes
        FROM empresas e
        LEFT JOIN planos p ON p.id = e.plano_id
        WHERE e.id = ?
        LIMIT 1
    `;

    db.query(sql, [empresaId], (err, result) => {
        if (err) {
            callback(err);
            return;
        }

        const limite = Number(result[0]?.limite_clientes || 0);

        if (!limite) {
            callback(null, true);
            return;
        }

        db.query('SELECT COUNT(*) AS total FROM clientes WHERE empresa_id = ?', [empresaId], (countErr, countResult) => {
            if (countErr) {
                callback(countErr);
                return;
            }

            callback(null, Number(countResult[0]?.total || 0) < limite);
        });
    });
}

exports.criarCliente = (req, res) => {

    const { nome, documento, cpf, telefone, whatsapp, email, endereco } = req.body;
    const empresaId = req.user.empresaId;
    const documentoLimpo = documento || cpf || null;
    const telefoneLimpo = telefone || null;
    const whatsappLimpo = whatsapp || null;
    const emailLimpo = email || null;
    const enderecoLimpo = endereco || null;

    validarLimiteClientes(empresaId, (limiteErr, permitido) => {
        if (limiteErr) {
            return res.status(500).json({ msg: 'Erro ao validar limite do plano', error: limiteErr.message });
        }

        if (!permitido) {
            return res.status(403).json({ msg: 'Limite de clientes do plano atingido' });
        }

        const sql = "INSERT INTO clientes (nome,cpf,telefone,whatsapp,email,endereco,empresa_id) VALUES (?,?,?,?,?,?,?)";

        db.query(sql, [nome, documentoLimpo, telefoneLimpo, whatsappLimpo, emailLimpo, enderecoLimpo, empresaId], (err, result) => {

            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({ msg: 'Documento já cadastrado nesta empresa' });
                }

                return res.status(500).json({ msg: 'Erro ao criar cliente', error: err.message });
            }

            res.status(201).json({ msg: "Cliente criado" });
        });
    });

};

exports.listarClientes = (req, res) => {
    const empresaId = req.user.empresaId;

    const sql = `
        SELECT
            c.id,
            c.nome,
            c.cpf AS documento,
            c.telefone,
            c.whatsapp,
            c.email,
            c.endereco,
            c.created_at,
            (
                SELECT COUNT(*)
                FROM processos p
                WHERE p.cliente_id = c.id AND p.empresa_id = c.empresa_id
            ) AS total_processos,
            (
                SELECT MAX(p.data_ultima_movimentacao)
                FROM processos p
                WHERE p.cliente_id = c.id AND p.empresa_id = c.empresa_id
            ) AS ultima_movimentacao
        FROM clientes c
        WHERE c.empresa_id = ?
        ORDER BY nome ASC
    `;

    db.query(sql, [empresaId], (err, result) => {
        if (err) return res.status(500).json({ msg: 'Erro ao listar clientes', error: err.message });

        res.json(result);

    });

};

exports.listarHistoricoProcessosCliente = (req, res) => {
    const empresaId = req.user.empresaId;
    const { id } = req.params;

    db.query(
        `
            SELECT
                c.id,
                c.nome,
                c.cpf,
                c.telefone,
                c.whatsapp,
                c.email,
                c.endereco,
                c.created_at,
                (
                    SELECT COUNT(*)
                    FROM processos p
                    WHERE p.cliente_id = c.id AND p.empresa_id = c.empresa_id
                ) AS total_processos,
                (
                    SELECT MAX(p.data_ultima_movimentacao)
                    FROM processos p
                    WHERE p.cliente_id = c.id AND p.empresa_id = c.empresa_id
                ) AS ultima_movimentacao
            FROM clientes c
            WHERE c.id = ? AND c.empresa_id = ?
            LIMIT 1
        `,
        [id, empresaId],
        (err, clienteRows) => {
            if (err) {
                return res.status(500).json({ msg: 'Erro ao carregar histórico do cliente', error: err.message });
            }

            if (!clienteRows.length) {
                return res.status(404).json({ msg: 'Cliente não encontrado' });
            }

            db.query(
                `
                    SELECT
                        p.id,
                        p.numero_processo,
                        p.tipo,
                        p.status,
                        p.andamento_percentual,
                        p.andamento_descricao,
                        p.custo_processo,
                        p.honorario_escritorio,
                        p.descricao,
                        p.data_abertura,
                        p.data_ultima_movimentacao,
                        p.created_at,
                        (
                            SELECT COUNT(*)
                            FROM processo_movimentos pm
                            WHERE pm.processo_id = p.id AND pm.empresa_id = p.empresa_id
                        ) AS total_movimentos
                    FROM processos p
                    WHERE p.cliente_id = ? AND p.empresa_id = ?
                    ORDER BY COALESCE(p.data_ultima_movimentacao, p.created_at) DESC
                `,
                [id, empresaId],
                (processosErr, processosRows) => {
                    if (processosErr) {
                        return res.status(500).json({ msg: 'Erro ao carregar processos do cliente', error: processosErr.message });
                    }

                    return res.json({
                        cliente: clienteRows[0],
                        processos: processosRows
                    });
                }
            );
        }
    );
};

exports.obterCliente = (req, res) => {
    const empresaId = req.user.empresaId;
    const { id } = req.params;

    db.query(
        `
            SELECT id, nome, cpf, telefone, whatsapp, email, endereco, created_at
            FROM clientes
            WHERE id = ? AND empresa_id = ?
            LIMIT 1
        `,
        [id, empresaId],
        (err, result) => {
            if (err) {
                return res.status(500).json({ msg: 'Erro ao carregar cliente', error: err.message });
            }

            if (!result.length) {
                return res.status(404).json({ msg: 'Cliente não encontrado' });
            }

            return res.json({
                ...result[0],
                documento: result[0].cpf
            });
        }
    );
};

exports.atualizarCliente = (req, res) => {
    const empresaId = req.user.empresaId;
    const { id } = req.params;
    const { nome, documento, cpf, telefone, whatsapp, email, endereco } = req.body || {};
    const documentoLimpo = documento || cpf || null;
    const whatsappLimpo = whatsapp || null;

    if (!nome) {
        return res.status(400).json({ msg: 'Nome é obrigatório' });
    }

    db.query(
        'SELECT id FROM clientes WHERE id = ? AND empresa_id = ? LIMIT 1',
        [id, empresaId],
        (checkErr, result) => {
            if (checkErr) {
                return res.status(500).json({ msg: 'Erro ao validar cliente', error: checkErr.message });
            }

            if (!result.length) {
                return res.status(404).json({ msg: 'Cliente não encontrado' });
            }

            const sql = `
                UPDATE clientes
                SET nome = ?, cpf = ?, telefone = ?, whatsapp = ?, email = ?, endereco = ?
                WHERE id = ? AND empresa_id = ?
            `;

            db.query(
                sql,
                [
                    nome.trim(),
                    documentoLimpo,
                    telefone || null,
                    whatsappLimpo,
                    email || null,
                    endereco || null,
                    id,
                    empresaId
                ],
                (err, updateResult) => {
                    if (err) {
                        if (err.code === 'ER_DUP_ENTRY') {
                            return res.status(409).json({ msg: 'Documento já cadastrado nesta empresa' });
                        }

                        return res.status(500).json({ msg: 'Erro ao atualizar cliente', error: err.message });
                    }

                    if (!updateResult.affectedRows) {
                        return res.status(404).json({ msg: 'Cliente não encontrado' });
                    }

                    return res.json({ msg: 'Cliente atualizado com sucesso' });
                }
            );
        }
    );
};

exports.excluirCliente = (req, res) => {
    const empresaId = req.user.empresaId;
    const { id } = req.params;

    db.query(
        'SELECT COUNT(*) AS total FROM processos WHERE cliente_id = ? AND empresa_id = ?',
        [id, empresaId],
        (checkErr, result) => {
            if (checkErr) {
                return res.status(500).json({ msg: 'Erro ao validar vínculos', error: checkErr.message });
            }

            if (Number(result[0]?.total || 0) > 0) {
                return res.status(409).json({ msg: 'Não é possível excluir um cliente com processos vinculados' });
            }

            db.query(
                'DELETE FROM clientes WHERE id = ? AND empresa_id = ?',
                [id, empresaId],
                (err, deleteResult) => {
                    if (err) {
                        return res.status(500).json({ msg: 'Erro ao excluir cliente', error: err.message });
                    }

                    if (!deleteResult.affectedRows) {
                        return res.status(404).json({ msg: 'Cliente não encontrado' });
                    }

                    return res.json({ msg: 'Cliente excluído com sucesso' });
                }
            );
        }
    );
};
