const db = require('../config/database');

exports.obterEmpresaLogada = (req, res) => {
    const sql = `
        SELECT e.id, e.nome, e.cnpj, e.email, e.telefone, e.status, e.created_at,
               p.nome AS plano_nome, p.preco_mensal, p.limite_usuarios, p.limite_clientes, p.limite_processos
        FROM empresas e
        LEFT JOIN planos p ON p.id = e.plano_id
        WHERE e.id = ?
        LIMIT 1
    `;

    db.query(sql, [req.user.empresaId], (err, result) => {
        if (err) {
            return res.status(500).json({ msg: 'Erro ao carregar empresa', error: err.message });
        }

        if (!result.length) {
            return res.status(404).json({ msg: 'Empresa não encontrada' });
        }

        res.json(result[0]);
    });
};

exports.atualizarEmpresaLogada = (req, res) => {
    const { nome, cnpj, email, telefone } = req.body || {};

    if (!nome || !cnpj) {
        return res.status(400).json({ msg: 'Nome e CNPJ são obrigatórios' });
    }

    const sql = `
        UPDATE empresas
        SET nome = ?, cnpj = ?, email = ?, telefone = ?
        WHERE id = ?
    `;

    db.query(sql, [nome, cnpj, email || null, telefone || null, req.user.empresaId], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ msg: 'CNPJ ou e-mail já cadastrado em outra empresa' });
            }

            return res.status(500).json({ msg: 'Erro ao atualizar empresa', error: err.message });
        }

        if (!result.affectedRows) {
            return res.status(404).json({ msg: 'Empresa não encontrada' });
        }

        res.json({ msg: 'Empresa atualizada com sucesso' });
    });
};
