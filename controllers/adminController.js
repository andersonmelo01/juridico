const bcrypt = require('bcryptjs');
const db = require('../config/database');

function normalizarData(valor) {
    if (!valor) {
        return null;
    }

    return valor;
}

function normalizarStatusLicenca(valor) {
    if (['ativa', 'vencida', 'suspensa'].includes(valor)) {
        return valor;
    }

    return 'ativa';
}

function validarPlano(planoId, callback) {
    if (!planoId) {
        callback(null, null);
        return;
    }

    db.query(
        'SELECT id FROM planos WHERE id = ? AND ativo = 1 LIMIT 1',
        [planoId],
        (planoErr, planoResult) => {
            if (planoErr) {
                callback(planoErr);
                return;
            }

            if (!planoResult.length) {
                callback(new Error('PLANO_INVALIDO'));
                return;
            }

            callback(null, true);
        }
    );
}

function validarRoleUsuario(role) {
    return ['admin', 'secretaria', 'estagiario'].includes(role);
}

function criarUsuarioNaEmpresa({ empresaId, nome, email, senha, role }, callback) {
    if (!nome || !email || !senha || !validarRoleUsuario(role)) {
        callback(new Error('DADOS_INVALIDOS'));
        return;
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
                callback(limiteErr);
                return;
            }

            const limiteUsuarios = Number(limiteResult[0]?.limite_usuarios || 0);
            if (limiteUsuarios) {
                db.query(
                    'SELECT COUNT(*) AS total FROM users WHERE empresa_id = ?',
                    [empresaId],
                    async (countErr, countResult) => {
                        if (countErr) {
                            callback(countErr);
                            return;
                        }

                        if (Number(countResult[0]?.total || 0) >= limiteUsuarios) {
                            callback(new Error('LIMITE_USUARIOS_ATINGIDO'));
                            return;
                        }

                        let senhaHash;

                        try {
                            senhaHash = await bcrypt.hash(senha, 10);
                        } catch (hashErr) {
                            callback(hashErr);
                            return;
                        }

                        db.query(
                            'INSERT INTO users (nome, email, senha, empresa_id, role) VALUES (?, ?, ?, ?, ?)',
                            [nome.trim(), email.trim(), senhaHash, empresaId, role],
                            (userErr, userResult) => {
                                if (userErr) {
                                    callback(userErr);
                                    return;
                                }

                                callback(null, userResult.insertId);
                            }
                        );
                    }
                );
                return;
            }

            let senhaHash;

            try {
                senhaHash = await bcrypt.hash(senha, 10);
            } catch (hashErr) {
                callback(hashErr);
                return;
            }

            db.query(
                'INSERT INTO users (nome, email, senha, empresa_id, role) VALUES (?, ?, ?, ?, ?)',
                [nome.trim(), email.trim(), senhaHash, empresaId, role],
                (userErr, userResult) => {
                    if (userErr) {
                        callback(userErr);
                        return;
                    }

                    callback(null, userResult.insertId);
                }
            );
        }
    );
}

function buscarUsuariosEmpresa(empresaId, callback) {
    db.query(
        `
            SELECT id, nome, email, role, created_at
            FROM users
            WHERE empresa_id = ?
            ORDER BY created_at DESC
        `,
        [empresaId],
        callback
    );
}

exports.resumo = (req, res) => {
    const sql = `
        SELECT
            (SELECT COUNT(*) FROM empresas WHERE status = 'pendente') AS pendentes,
            (SELECT COUNT(*) FROM empresas WHERE status = 'aprovada') AS aprovadas,
            (SELECT COUNT(*) FROM planos WHERE ativo = 1) AS planos_ativos
    `;

    db.query(sql, (err, result) => {
        if (err) {
            return res.status(500).json({ msg: 'Erro ao carregar resumo', error: err.message });
        }

        res.json(result[0]);
    });
};

exports.listarEmpresas = (req, res) => {
    const sql = `
        SELECT
            e.id,
            e.nome,
            e.cnpj,
            e.email,
            e.telefone,
            e.status,
            e.plano_id,
            e.licenca_status,
            e.licenca_inicio,
            e.licenca_fim,
            e.created_at,
            (
                SELECT u.nome
                FROM users u
                WHERE u.empresa_id = e.id AND u.role = 'admin'
                ORDER BY u.created_at ASC
                LIMIT 1
            ) AS admin_nome,
            (
                SELECT u.email
                FROM users u
                WHERE u.empresa_id = e.id AND u.role = 'admin'
                ORDER BY u.created_at ASC
                LIMIT 1
            ) AS admin_email,
            p.nome AS plano_nome,
            p.preco_mensal,
            p.limite_usuarios,
            p.limite_clientes,
            p.limite_processos,
            (SELECT COUNT(*) FROM users u WHERE u.empresa_id = e.id) AS qtd_usuarios
        FROM empresas e
        LEFT JOIN planos p ON p.id = e.plano_id
        ORDER BY e.created_at DESC
    `;

    db.query(sql, (err, result) => {
        if (err) {
            return res.status(500).json({ msg: 'Erro ao listar escritórios', error: err.message });
        }

        res.json(result);
    });
};

exports.listarPreCadastros = (req, res) => {
    const sql = `
        SELECT
            e.id,
            e.nome,
            e.cnpj,
            e.email,
            e.telefone,
            e.status,
            e.licenca_status,
            e.licenca_inicio,
            e.licenca_fim,
            e.created_at,
            p.nome AS plano_nome,
            p.preco_mensal,
            p.limite_usuarios,
            p.limite_clientes,
            p.limite_processos
        FROM empresas e
        LEFT JOIN planos p ON p.id = e.plano_id
        WHERE e.status = 'pendente'
        ORDER BY e.created_at DESC
    `;

    db.query(sql, (err, result) => {
        if (err) {
            return res.status(500).json({ msg: 'Erro ao listar pre-cadastros', error: err.message });
        }

        res.json(result);
    });
};

exports.criarEmpresa = (req, res) => {
    const {
        empresa = {},
        admin = {},
        licenca = {}
    } = req.body || {};

    const nomeEmpresa = (empresa.nome || '').trim();
    const cnpj = (empresa.cnpj || '').trim();
    const emailEmpresa = (empresa.email || '').trim();
    const telefoneEmpresa = (empresa.telefone || '').trim();
    const planoId = empresa.plano_id ? Number(empresa.plano_id) : null;
    const statusEmpresa = ['pendente', 'aprovada', 'bloqueada'].includes(empresa.status) ? empresa.status : 'aprovada';
    const nomeAdmin = (admin.nome || '').trim();
    const emailAdmin = (admin.email || '').trim();
    const senhaAdmin = admin.senha || '';
    const licencaInicio = normalizarData(licenca.inicio);
    const licencaFim = normalizarData(licenca.fim);
    const licencaStatus = normalizarStatusLicenca(licenca.status);

    if (!nomeEmpresa || !cnpj || !nomeAdmin || !emailAdmin || !senhaAdmin) {
        return res.status(400).json({ msg: 'Preencha os campos obrigatórios' });
    }

    validarPlano(planoId, async (planoErr) => {
        if (planoErr) {
            if (planoErr.message === 'PLANO_INVALIDO') {
                return res.status(400).json({ msg: 'Plano inválido' });
            }

            return res.status(500).json({ msg: 'Erro ao validar plano', error: planoErr.message });
        }

        let senhaHash;

        try {
            senhaHash = await bcrypt.hash(senhaAdmin, 10);
        } catch (hashErr) {
            return res.status(500).json({ msg: 'Erro ao processar senha', error: hashErr.message });
        }

        db.getConnection((connectionErr, connection) => {
            if (connectionErr) {
                return res.status(500).json({ msg: 'Erro ao abrir transação', error: connectionErr.message });
            }

            connection.beginTransaction((transactionErr) => {
                if (transactionErr) {
                    connection.release();
                    return res.status(500).json({ msg: 'Erro na transação', error: transactionErr.message });
                }

                connection.query(
                    'INSERT INTO empresas (nome, cnpj, email, telefone, status, plano_id, licenca_inicio, licenca_fim, licenca_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [
                        nomeEmpresa,
                        cnpj,
                        emailEmpresa || null,
                        telefoneEmpresa || null,
                        statusEmpresa,
                        planoId,
                        licencaInicio,
                        licencaFim,
                        licencaStatus
                    ],
                    (empresaErr, empresaResult) => {
                        if (empresaErr) {
                            return connection.rollback(() => {
                                connection.release();
                                if (empresaErr.code === 'ER_DUP_ENTRY') {
                                    return res.status(409).json({ msg: 'Já existe uma empresa com este CNPJ ou e-mail' });
                                }
                                return res.status(500).json({ msg: 'Erro ao criar escritório', error: empresaErr.message });
                            });
                        }

                        const empresaId = empresaResult.insertId;

                        connection.query(
                            'INSERT INTO users (nome, email, senha, empresa_id, role) VALUES (?, ?, ?, ?, ?)',
                            [nomeAdmin, emailAdmin, senhaHash, empresaId, 'admin'],
                            (userErr, userResult) => {
                                if (userErr) {
                                    return connection.rollback(() => {
                                        connection.release();
                                        if (userErr.code === 'ER_DUP_ENTRY') {
                                            return res.status(409).json({ msg: 'Já existe um usuário com este e-mail nesta empresa' });
                                        }
                                        return res.status(500).json({ msg: 'Erro ao criar usuário administrador', error: userErr.message });
                                    });
                                }

                                connection.commit((commitErr) => {
                                    if (commitErr) {
                                        return connection.rollback(() => {
                                            connection.release();
                                            return res.status(500).json({ msg: 'Erro ao finalizar criação', error: commitErr.message });
                                        });
                                    }

                                    connection.release();
                                    return res.status(201).json({
                                        msg: 'Escritório criado com sucesso',
                                        empresaId,
                                        adminId: userResult.insertId
                                    });
                                });
                            }
                        );
                    }
                );
            });
        });
    });
};

exports.atualizarEmpresa = (req, res) => {
    const { id } = req.params;
    const {
        nome,
        cnpj,
        email,
        telefone,
        plano_id,
        status,
        licenca_inicio,
        licenca_fim,
        licenca_status
    } = req.body || {};

    const planoId = plano_id ? Number(plano_id) : null;

    if (String(id) === '2') {
        return res.status(403).json({ msg: 'A empresa da plataforma não pode ser alterada aqui' });
    }

    validarPlano(planoId, (planoErr) => {
        if (planoErr) {
            if (planoErr.message === 'PLANO_INVALIDO') {
                return res.status(400).json({ msg: 'Plano inválido' });
            }

            return res.status(500).json({ msg: 'Erro ao validar plano', error: planoErr.message });
        }

        const sql = `
            UPDATE empresas
            SET
                nome = ?,
                cnpj = ?,
                email = ?,
                telefone = ?,
                plano_id = ?,
                status = ?,
                licenca_inicio = ?,
                licenca_fim = ?,
                licenca_status = ?
            WHERE id = ?
        `;

        db.query(
            sql,
            [
                nome,
                cnpj,
                email || null,
                telefone || null,
                planoId,
                status || 'aprovada',
                normalizarData(licenca_inicio),
                normalizarData(licenca_fim),
                normalizarStatusLicenca(licenca_status),
                id
            ],
            (err, result) => {
                if (err) {
                    if (err.code === 'ER_DUP_ENTRY') {
                        return res.status(409).json({ msg: 'CNPJ ou e-mail já cadastrado em outra empresa' });
                    }

                    return res.status(500).json({ msg: 'Erro ao atualizar escritório', error: err.message });
                }

                if (!result.affectedRows) {
                    return res.status(404).json({ msg: 'Escritório não encontrado' });
                }

                res.json({ msg: 'Escritório atualizado com sucesso' });
            }
        );
    });
};

exports.excluirEmpresa = (req, res) => {
    const { id } = req.params;

    if (String(id) === '2') {
        return res.status(403).json({ msg: 'A empresa da plataforma não pode ser excluída' });
    }

    db.query('DELETE FROM empresas WHERE id = ? AND id <> 2', [id], (err, result) => {
        if (err) {
            return res.status(500).json({ msg: 'Erro ao excluir escritório', error: err.message });
        }

        if (!result.affectedRows) {
            return res.status(404).json({ msg: 'Escritório não encontrado' });
        }

        res.json({ msg: 'Escritório excluído com sucesso' });
    });
};

exports.atualizarLicenca = (req, res) => {
    const { id } = req.params;
    const {
        plano_id,
        licenca_inicio,
        licenca_fim,
        licenca_status
    } = req.body || {};

    const planoId = plano_id ? Number(plano_id) : null;

    validarPlano(planoId, (planoErr) => {
        if (planoErr) {
            if (planoErr.message === 'PLANO_INVALIDO') {
                return res.status(400).json({ msg: 'Plano inválido' });
            }

            return res.status(500).json({ msg: 'Erro ao validar plano', error: planoErr.message });
        }

        const sql = `
            UPDATE empresas
            SET plano_id = ?, licenca_inicio = ?, licenca_fim = ?, licenca_status = ?
            WHERE id = ?
        `;

        db.query(
            sql,
            [
                planoId,
                normalizarData(licenca_inicio),
                normalizarData(licenca_fim),
                normalizarStatusLicenca(licenca_status),
                id
            ],
            (err, result) => {
                if (err) {
                    return res.status(500).json({ msg: 'Erro ao atualizar licença', error: err.message });
                }

                if (!result.affectedRows) {
                    return res.status(404).json({ msg: 'Escritório não encontrado' });
                }

                res.json({ msg: 'Licença atualizada com sucesso' });
            }
        );
    });
};

exports.listarPlanos = (req, res) => {
    const sql = `
        SELECT id, nome, descricao, preco_mensal, limite_usuarios, limite_clientes, limite_processos, ativo
        FROM planos
        ORDER BY preco_mensal ASC
    `;

    db.query(sql, (err, result) => {
        if (err) {
            return res.status(500).json({ msg: 'Erro ao listar planos', error: err.message });
        }

        res.json(result);
    });
};

exports.criarPlano = (req, res) => {
    const {
        nome,
        descricao,
        preco_mensal,
        limite_usuarios,
        limite_clientes,
        limite_processos
    } = req.body || {};

    if (!nome) {
        return res.status(400).json({ msg: 'Nome do plano é obrigatório' });
    }

    const sql = `
        INSERT INTO planos (nome, descricao, preco_mensal, limite_usuarios, limite_clientes, limite_processos)
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [
            nome,
            descricao || null,
            Number(preco_mensal || 0),
            Number(limite_usuarios || 0),
            Number(limite_clientes || 0),
            Number(limite_processos || 0)
        ],
        (err, result) => {
            if (err) {
                return res.status(500).json({ msg: 'Erro ao criar plano', error: err.message });
            }

            res.status(201).json({ msg: 'Plano criado com sucesso', planoId: result.insertId });
        }
    );
};

exports.criarUsuarioEmpresa = (req, res) => {
    const empresaId = Number(req.params.id);
    const { nome, email, senha, role } = req.body || {};

    if (!empresaId) {
        return res.status(400).json({ msg: 'Empresa inválida' });
    }

    criarUsuarioNaEmpresa({ empresaId, nome, email, senha, role }, (err, usuarioId) => {
        if (err) {
            if (err.message === 'DADOS_INVALIDOS') {
                return res.status(400).json({ msg: 'Preencha nome, e-mail, senha e perfil' });
            }

            if (err.message === 'LIMITE_USUARIOS_ATINGIDO') {
                return res.status(403).json({ msg: 'Limite de usuários do plano atingido' });
            }

            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ msg: 'Já existe um usuário com este e-mail nesta empresa' });
            }

            return res.status(500).json({ msg: 'Erro ao criar usuário do escritório', error: err.message });
        }

        return res.status(201).json({ msg: 'Usuário criado com sucesso', usuarioId });
    });
};

exports.listarUsuariosEmpresa = (req, res) => {
    const empresaId = Number(req.params.id);

    if (!empresaId) {
        return res.status(400).json({ msg: 'Empresa inválida' });
    }

    buscarUsuariosEmpresa(empresaId, (err, usuarios) => {
        if (err) {
            return res.status(500).json({ msg: 'Erro ao listar usuários do escritório', error: err.message });
        }

        res.json(usuarios);
    });
};

exports.atualizarUsuarioEmpresa = (req, res) => {
    const empresaId = Number(req.params.id);
    const usuarioId = Number(req.params.usuarioId);
    const { nome, email, senha, role } = req.body || {};

    if (!empresaId || !usuarioId) {
        return res.status(400).json({ msg: 'Empresa ou usuário inválido' });
    }

    if (!nome || !email || !validarRoleUsuario(role)) {
        return res.status(400).json({ msg: 'Preencha nome, e-mail e perfil' });
    }

    const atualizar = async (senhaHash = null) => {
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
            ? [nome.trim(), email.trim(), senhaHash, role, usuarioId, empresaId]
            : [nome.trim(), email.trim(), role, usuarioId, empresaId];

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

            return res.json({ msg: 'Usuário atualizado com sucesso' });
        });
    };

    if (!senha) {
        atualizar();
        return;
    }

    bcrypt.hash(senha, 10)
        .then((senhaHash) => atualizar(senhaHash))
        .catch((hashErr) => res.status(500).json({ msg: 'Erro ao processar senha', error: hashErr.message }));
};

exports.excluirUsuarioEmpresa = (req, res) => {
    const empresaId = Number(req.params.id);
    const usuarioId = Number(req.params.usuarioId);

    if (!empresaId || !usuarioId) {
        return res.status(400).json({ msg: 'Empresa ou usuário inválido' });
    }

    db.query(
        'DELETE FROM users WHERE id = ? AND empresa_id = ?',
        [usuarioId, empresaId],
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

exports.aprovarEmpresa = (req, res) => {
    const { id } = req.params;
    const { plano_id } = req.body || {};
    const planoId = plano_id ? Number(plano_id) : null;

    if (!planoId) {
        return res.status(400).json({ msg: 'Selecione um plano para aprovar o escritório' });
    }

    const validarPlano = (callback) => {
        db.query(
            'SELECT id FROM planos WHERE id = ? AND ativo = 1 LIMIT 1',
            [planoId],
            (planoErr, planoResult) => {
                if (planoErr) {
                    callback(planoErr);
                    return;
                }

                if (!planoResult.length) {
                    callback(new Error('PLANO_INVALIDO'));
                    return;
                }

                callback(null);
            }
        );
    };

    validarPlano((planoErr) => {
        if (planoErr) {
            if (planoErr.message === 'PLANO_INVALIDO') {
                return res.status(400).json({ msg: 'Plano inválido' });
            }

            return res.status(500).json({ msg: 'Erro ao validar plano', error: planoErr.message });
        }

        const sql = `
            UPDATE empresas
            SET status = 'aprovada', plano_id = ?, aprovado_em = NOW(), aprovado_por = ?
            WHERE id = ? AND status = 'pendente'
        `;

        db.query(sql, [planoId, req.user.id, id], (err, result) => {
            if (err) {
                return res.status(500).json({ msg: 'Erro ao aprovar empresa', error: err.message });
            }

            if (!result.affectedRows) {
                return res.status(404).json({ msg: 'Empresa pendente não encontrada' });
            }

            res.json({ msg: 'Escritório aprovado com sucesso' });
        });
    });
};

exports.rejeitarEmpresa = (req, res) => {
    const { id } = req.params;

    const sql = `
        UPDATE empresas
        SET status = 'bloqueada', aprovado_em = NOW(), aprovado_por = ?
        WHERE id = ? AND status = 'pendente'
    `;

    db.query(sql, [req.user.id, id], (err, result) => {
        if (err) {
            return res.status(500).json({ msg: 'Erro ao rejeitar empresa', error: err.message });
        }

        if (!result.affectedRows) {
            return res.status(404).json({ msg: 'Empresa pendente não encontrada' });
        }

        res.json({ msg: 'Escritório bloqueado' });
    });
};
