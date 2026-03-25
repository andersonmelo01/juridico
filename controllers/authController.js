const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'segredo';
const MASTER_ACCESS_PASSWORD = process.env.MASTER_ACCESS_PASSWORD || 'Mestre@123';
const MASTER_ACCESS_EMAIL = process.env.MASTER_ACCESS_EMAIL || 'master@plataforma.local';

function criarToken(usuario) {
    return jwt.sign(
        {
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            role: usuario.role || 'admin',
            empresaId: usuario.empresa_id,
            empresaNome: usuario.empresa_nome,
            empresaStatus: usuario.empresa_status,
            empresaLicencaStatus: usuario.licenca_status,
            empresaLicencaFim: usuario.licenca_fim,
            planoId: usuario.plano_id,
            planoNome: usuario.plano_nome
        },
        JWT_SECRET,
        { expiresIn: '8h' }
    );
}

exports.listarEmpresas = (req, res) => {
    const sql = `
        SELECT e.id, e.nome, e.cnpj, e.email, e.telefone, e.status, e.licenca_status, e.licenca_fim, e.plano_id, p.nome AS plano_nome
        FROM empresas e
        LEFT JOIN planos p ON p.id = e.plano_id
        WHERE e.status = 'aprovada' AND e.id <> 2
        ORDER BY nome ASC
    `;

    db.query(sql, (err, result) => {
        if (err) return res.status(500).json({ msg: 'Erro ao listar empresas', error: err.message });

        res.json(result);
    });
};

exports.me = (req, res) => {
    res.json({
        id: req.user.id,
        nome: req.user.nome,
        email: req.user.email,
        role: req.user.role,
        empresaId: req.user.empresaId,
        empresaNome: req.user.empresaNome,
        empresaStatus: req.user.empresaStatus,
        empresaLicencaStatus: req.user.empresaLicencaStatus,
        empresaLicencaFim: req.user.empresaLicencaFim,
        planoId: req.user.planoId,
        planoNome: req.user.planoNome
    });
};

exports.masterLogin = (req, res) => {
    const { senha, password } = req.body || {};
    const masterPassword = senha || password || '';

    if (!masterPassword) {
        return res.status(400).json({ msg: 'Informe a senha mestre' });
    }

    if (masterPassword !== MASTER_ACCESS_PASSWORD) {
        return res.status(401).json({ msg: 'Senha mestre inválida' });
    }

    const usuarioMestre = {
        id: 0,
        nome: 'Administrador Mestre',
        email: MASTER_ACCESS_EMAIL,
        role: 'platform_admin',
        empresa_id: null,
        empresa_nome: 'Plataforma',
        empresa_status: 'aprovada',
        licenca_status: 'ativa',
        licenca_fim: null,
        plano_id: null,
        plano_nome: 'Master'
    };

    const token = criarToken(usuarioMestre);

    return res.json({
        token,
        user: {
            id: usuarioMestre.id,
            nome: usuarioMestre.nome,
            email: usuarioMestre.email,
            role: usuarioMestre.role
        },
        empresa: {
            id: null,
            nome: usuarioMestre.empresa_nome,
            status: usuarioMestre.empresa_status,
            licencaStatus: usuarioMestre.licenca_status,
            licencaFim: usuarioMestre.licenca_fim,
            planoId: usuarioMestre.plano_id,
            planoNome: usuarioMestre.plano_nome
        }
    });
};

exports.register = (req, res) => {
    const { empresa, admin } = req.body || {};

    if (!empresa || !admin) {
        return res.status(400).json({ msg: 'Dados da empresa e do administrador são obrigatórios' });
    }

    const nomeEmpresa = (empresa.nome || '').trim();
    const cnpj = (empresa.cnpj || '').trim();
    const emailEmpresa = (empresa.email || '').trim();
    const telefoneEmpresa = (empresa.telefone || '').trim();
    const planoId = empresa.plano_id ? Number(empresa.plano_id) : null;
    const nomeAdmin = (admin.nome || '').trim();
    const emailAdmin = (admin.email || '').trim();
    const senhaAdmin = admin.senha || '';

    if (!nomeEmpresa || !cnpj || !nomeAdmin || !emailAdmin || !senhaAdmin) {
        return res.status(400).json({ msg: 'Preencha os campos obrigatórios' });
    }

    db.query(
        'SELECT id FROM empresas WHERE cnpj = ? OR email = ?',
        [cnpj, emailEmpresa || null],
        async (err, empresasEncontradas) => {
            if (err) {
                return res.status(500).json({ msg: 'Erro ao validar empresa', error: err.message });
            }

            if (empresasEncontradas.length > 0) {
                return res.status(409).json({ msg: 'Já existe uma empresa cadastrada com este CNPJ ou e-mail' });
            }

            let senhaHash;

            try {
                senhaHash = await bcrypt.hash(senhaAdmin, 10);
            } catch (hashErr) {
                return res.status(500).json({ msg: 'Erro ao processar senha', error: hashErr.message });
            }

            const validarPlano = (callback) => {
                if (!planoId) {
                    callback(null);
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
                                'INSERT INTO empresas (nome, cnpj, email, telefone, status, plano_id, licenca_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
                                [nomeEmpresa, cnpj, emailEmpresa || null, telefoneEmpresa || null, 'pendente', planoId, 'ativa'],
                                (empresaInsertErr, empresaResult) => {
                                    if (empresaInsertErr) {
                                        return connection.rollback(() => {
                                            connection.release();
                                            if (empresaInsertErr.code === 'ER_DUP_ENTRY') {
                                                return res.status(409).json({ msg: 'Já existe uma empresa com este CNPJ ou e-mail' });
                                            }
                                            return res.status(500).json({ msg: 'Erro ao criar empresa', error: empresaInsertErr.message });
                                        });
                                    }

                            const empresaId = empresaResult.insertId;

                            connection.query(
                                'INSERT INTO users (nome, email, senha, empresa_id, role) VALUES (?, ?, ?, ?, ?)',
                                [nomeAdmin, emailAdmin, senhaHash, empresaId, 'admin'],
                                (userInsertErr) => {
                                    if (userInsertErr) {
                                        return connection.rollback(() => {
                                            connection.release();
                                            if (userInsertErr.code === 'ER_DUP_ENTRY') {
                                                return res.status(409).json({ msg: 'Já existe um usuário com este e-mail nesta empresa' });
                                            }
                                            return res.status(500).json({ msg: 'Erro ao criar usuário administrador', error: userInsertErr.message });
                                        });
                                    }

                                    connection.commit((commitErr) => {
                                        if (commitErr) {
                                            return connection.rollback(() => {
                                                connection.release();
                                                return res.status(500).json({ msg: 'Erro ao finalizar cadastro', error: commitErr.message });
                                            });
                                        }

                                        connection.release();
                                        return res.status(201).json({
                                            msg: 'Pré-cadastro enviado com sucesso',
                                            empresaId
                                        });
                                    });
                                }
                            );
                        }
                    );
                });
            });
            });
        }
    );
};

exports.login = (req, res) => {
    const { email, senha, empresa_id } = req.body || {};

    if (!email || !senha || !empresa_id) {
        return res.status(400).json({ msg: 'Informe e-mail, senha e empresa' });
    }

    const sql = `
        SELECT
            u.id,
            u.nome,
            u.email,
            u.senha,
            u.role,
            u.empresa_id,
            e.nome AS empresa_nome,
            e.cnpj AS empresa_cnpj,
            e.status AS empresa_status,
            e.licenca_status,
            e.licenca_fim,
            e.plano_id,
            p.nome AS plano_nome
        FROM users u
        INNER JOIN empresas e ON e.id = u.empresa_id
        LEFT JOIN planos p ON p.id = e.plano_id
        WHERE u.email = ? AND u.empresa_id = ?
        LIMIT 1
    `;

    db.query(sql, [email, empresa_id], async (err, result) => {
        if (err) {
            return res.status(500).json({ msg: 'Erro ao autenticar', error: err.message });
        }

        if (!result.length) {
            return res.status(401).json({ msg: 'Usuário ou senha inválidos' });
        }

        const usuario = result[0];

        if (usuario.role !== 'platform_admin' && usuario.empresa_status !== 'aprovada') {
            return res.status(403).json({ msg: 'Escritório aguardando validação administrativa' });
        }

        let senhaValida = false;

        try {
            senhaValida = await bcrypt.compare(senha, usuario.senha);
        } catch (compareErr) {
            return res.status(500).json({ msg: 'Erro ao validar senha', error: compareErr.message });
        }

        if (!senhaValida) {
            return res.status(401).json({ msg: 'Usuário ou senha inválidos' });
        }

        if (usuario.role === 'platform_admin') {
            return res.status(403).json({ msg: 'Use o acesso mestre para entrar na administração da plataforma' });
        }

        const licencaExpirada = usuario.licenca_fim && new Date(usuario.licenca_fim) < new Date();
        if (usuario.empresa_status !== 'aprovada' || usuario.licenca_status === 'suspensa' || licencaExpirada) {
            return res.status(403).json({ msg: 'Escritório sem licença ativa' });
        }

        const token = criarToken(usuario);

        res.json({
            token,
            user: {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email,
                role: usuario.role || 'admin'
            },
            empresa: {
                id: usuario.empresa_id,
                nome: usuario.empresa_nome,
                cnpj: usuario.empresa_cnpj,
                status: usuario.empresa_status,
                licencaStatus: usuario.licenca_status,
                licencaFim: usuario.licenca_fim,
                planoId: usuario.plano_id,
                planoNome: usuario.plano_nome
            }
        });
    });
};

exports.listarPlanos = (req, res) => {
    const sql = `
        SELECT id, nome, descricao, preco_mensal, limite_usuarios, limite_clientes, limite_processos, ativo
        FROM planos
        WHERE ativo = 1
        ORDER BY preco_mensal ASC
    `;

    db.query(sql, (err, result) => {
        if (err) {
            return res.status(500).json({ msg: 'Erro ao listar planos', error: err.message });
        }

        res.json(result);
    });
};
