const bcrypt = require('bcryptjs');
const db = require('../config/database');

const ROLES_VALIDOS = ['admin', 'secretaria', 'estagiario'];

function validarRole(role) {
    return ROLES_VALIDOS.includes(role);
}

exports.listarUsuarios = (req, res) => {
    const empresaId = req.user.empresaId;

    const sql = `
        SELECT id, nome, email, role, created_at
        FROM users
        WHERE empresa_id = ?
        ORDER BY created_at DESC
    `;

    db.query(sql, [empresaId], (err, result) => {
        if (err) {
            return res.status(500).json({ msg: 'Erro ao listar usuários', error: err.message });
        }

        res.json(result);
    });
};

exports.criarUsuario = async (req, res) => {
    const empresaId = req.user.empresaId;
    const { nome, email, senha, role } = req.body || {};

    if (!nome || !email || !senha) {
        return res.status(400).json({ msg: 'Nome, e-mail e senha são obrigatórios' });
    }

    if (!validarRole(role)) {
        return res.status(400).json({ msg: 'Perfil inválido' });
    }

    db.query(
        `
            SELECT p.limite_usuarios
            FROM empresas e
            LEFT JOIN planos p ON p.id = e.plano_id
            WHERE e.id = ?
            LIMIT 1
        `,
        [empresaId],
        async (limiteErr, limiteResult) => {
            if (limiteErr) {
                return res.status(500).json({ msg: 'Erro ao validar limite do plano', error: limiteErr.message });
            }

            const limiteUsuarios = Number(limiteResult[0]?.limite_usuarios || 0);
            if (limiteUsuarios) {
                db.query('SELECT COUNT(*) AS total FROM users WHERE empresa_id = ?', [empresaId], async (countErr, countResult) => {
                    if (countErr) {
                        return res.status(500).json({ msg: 'Erro ao contar usuários', error: countErr.message });
                    }

                    if (Number(countResult[0]?.total || 0) >= limiteUsuarios) {
                        return res.status(403).json({ msg: 'Limite de usuários do plano atingido' });
                    }

                    await criarUsuarioInterno();
                });
                return;
            }

            await criarUsuarioInterno();
        }
    );

    async function criarUsuarioInterno() {
        let senhaHash;

        try {
            senhaHash = await bcrypt.hash(senha, 10);
        } catch (hashErr) {
            return res.status(500).json({ msg: 'Erro ao processar senha', error: hashErr.message });
        }

        const sql = `
            INSERT INTO users (nome, email, senha, empresa_id, role)
            VALUES (?, ?, ?, ?, ?)
        `;

        db.query(sql, [nome.trim(), email.trim(), senhaHash, empresaId, role], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({ msg: 'Já existe um usuário com este e-mail nesta empresa' });
                }

                return res.status(500).json({ msg: 'Erro ao criar usuário', error: err.message });
            }

            res.status(201).json({ msg: 'Usuário criado com sucesso', usuarioId: result.insertId });
        });
    }
};

exports.atualizarUsuario = async (req, res) => {
    const empresaId = req.user.empresaId;
    const { id } = req.params;
    const { nome, email, senha, role } = req.body || {};

    if (!nome || !email || !validarRole(role)) {
        return res.status(400).json({ msg: 'Nome, e-mail e perfil são obrigatórios' });
    }

    if (String(req.user.id) === String(id) && role !== 'admin') {
        return res.status(400).json({ msg: 'Você não pode remover seu próprio perfil de administrador' });
    }

    const atualizarSenha = async () => {
        if (!senha) {
            return null;
        }

        return bcrypt.hash(senha, 10);
    };

    let senhaHash = null;

    try {
        senhaHash = await atualizarSenha();
    } catch (hashErr) {
        return res.status(500).json({ msg: 'Erro ao processar senha', error: hashErr.message });
    }

    const sql = senhaHash
        ? `
            UPDATE users
            SET nome = ?, email = ?, senha = ?, role = ?
            WHERE id = ? AND empresa_id = ?
        `
        : `
            UPDATE users
            SET nome = ?, email = ?, role = ?
            WHERE id = ? AND empresa_id = ?
        `;

    const params = senhaHash
        ? [nome.trim(), email.trim(), senhaHash, role, id, empresaId]
        : [nome.trim(), email.trim(), role, id, empresaId];

    db.query(sql, params, (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ msg: 'Já existe um usuário com este e-mail nesta empresa' });
            }

            return res.status(500).json({ msg: 'Erro ao atualizar usuário', error: err.message });
        }

        if (!result.affectedRows) {
            return res.status(404).json({ msg: 'Usuário não encontrado' });
        }

        res.json({ msg: 'Usuário atualizado com sucesso' });
    });
};

exports.excluirUsuario = (req, res) => {
    const empresaId = req.user.empresaId;
    const { id } = req.params;

    if (String(req.user.id) === String(id)) {
        return res.status(400).json({ msg: 'Você não pode excluir o seu próprio usuário' });
    }

    db.query(
        'DELETE FROM users WHERE id = ? AND empresa_id = ?',
        [id, empresaId],
        (err, result) => {
            if (err) {
                return res.status(500).json({ msg: 'Erro ao excluir usuário', error: err.message });
            }

            if (!result.affectedRows) {
                return res.status(404).json({ msg: 'Usuário não encontrado' });
            }

            res.json({ msg: 'Usuário excluído com sucesso' });
        }
    );
};
