const db = require('../config/database');

function normalizarDecimal(valor) {
    if (valor === undefined || valor === null || valor === '') {
        return 0;
    }

    const numero = Number(String(valor).replace(',', '.'));
    return Number.isNaN(numero) ? 0 : numero;
}

function normalizarPercentual(valor) {
    if (valor === undefined || valor === null || valor === '') {
        return 0;
    }

    const numero = parseInt(valor, 10);
    if (Number.isNaN(numero)) {
        return 0;
    }

    return Math.max(0, Math.min(100, numero));
}

function validarLimiteProcessos(empresaId, callback) {
    const sql = `
        SELECT p.limite_processos
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

        const limite = Number(result[0]?.limite_processos || 0);

        if (!limite) {
            callback(null, true);
            return;
        }

        db.query('SELECT COUNT(*) AS total FROM processos WHERE empresa_id = ?', [empresaId], (countErr, countResult) => {
            if (countErr) {
                callback(countErr);
                return;
            }

            callback(null, Number(countResult[0]?.total || 0) < limite);
        });
    });
}

exports.criarProcesso = (req, res) => {

    const {
        numero_processo,
        cliente_id,
        tipo,
        status,
        andamento_percentual,
        andamento_descricao,
        custo_processo,
        honorario_escritorio,
        descricao,
        data_abertura
    } = req.body;
    const empresaId = req.user.empresaId;

    if (!numero_processo || !cliente_id) {
        return res.status(400).json({ msg: 'Número do processo e cliente são obrigatórios' });
    }

    db.query(
        'SELECT id FROM clientes WHERE id = ? AND empresa_id = ? LIMIT 1',
        [cliente_id, empresaId],
        (clienteErr, clienteResult) => {
            if (clienteErr) {
                return res.status(500).json({ msg: 'Erro ao validar cliente', error: clienteErr.message });
            }

            if (!clienteResult.length) {
                return res.status(404).json({ msg: 'Cliente não encontrado nesta empresa' });
            }

            validarLimiteProcessos(empresaId, (limiteErr, permitido) => {
                if (limiteErr) {
                    return res.status(500).json({ msg: 'Erro ao validar limite do plano', error: limiteErr.message });
                }

                if (!permitido) {
                    return res.status(403).json({ msg: 'Limite de processos do plano atingido' });
                }

                db.getConnection((connectionErr, connection) => {
                if (connectionErr) {
                    return res.status(500).json({ msg: 'Erro ao acessar banco', error: connectionErr.message });
                }

                connection.beginTransaction((txErr) => {
                    if (txErr) {
                        connection.release();
                        return res.status(500).json({ msg: 'Erro ao iniciar transação', error: txErr.message });
                    }

                    const sql = `
                        INSERT INTO processos
                        (numero_processo, cliente_id, tipo, status, andamento_percentual, andamento_descricao, custo_processo, honorario_escritorio, descricao, data_abertura, data_ultima_movimentacao, empresa_id)
                        VALUES (?,?,?,?,?,?,?,?,?,?,NOW(),?)
                    `;

                    connection.query(
                        sql,
                        [
                            numero_processo,
                            cliente_id,
                            tipo || null,
                            status || 'Em andamento',
                            normalizarPercentual(andamento_percentual),
                            andamento_descricao || null,
                            normalizarDecimal(custo_processo),
                            normalizarDecimal(honorario_escritorio),
                            descricao || null,
                            data_abertura || null,
                            empresaId
                        ],
                        (err, result) => {
                            if (err) {
                                return connection.rollback(() => {
                                    connection.release();
                                    if (err.code === 'ER_DUP_ENTRY') {
                                        return res.status(409).json({ msg: 'Número do processo já cadastrado nesta empresa' });
                                    }

                                    return res.status(500).json({ msg: 'Erro ao cadastrar processo', error: err.message });
                                });
                            }

                            const processoId = result.insertId;

                            connection.query(
                                `
                                    INSERT INTO processo_movimentos
                                    (processo_id, empresa_id, andamento_percentual, andamento_descricao, observacao, custo_extra)
                                    VALUES (?, ?, ?, ?, ?, ?)
                                `,
                                [
                                    processoId,
                                    empresaId,
                                    normalizarPercentual(andamento_percentual),
                                    andamento_descricao || 'Abertura do processo',
                                    descricao || null,
                                    0
                                ],
                                (movErr) => {
                                    if (movErr) {
                                        return connection.rollback(() => {
                                            connection.release();
                                            return res.status(500).json({ msg: 'Erro ao registrar andamento inicial', error: movErr.message });
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
                                        res.status(201).json({ msg: 'Processo cadastrado' });
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

exports.listarProcessos = (req, res) => {
    const empresaId = req.user.empresaId;

    const sql = `
        SELECT
            processos.id,
            processos.numero_processo,
            processos.tipo,
            processos.status,
            processos.andamento_percentual,
            processos.andamento_descricao,
            processos.custo_processo,
            processos.honorario_escritorio,
            processos.descricao,
            processos.data_abertura,
            processos.data_ultima_movimentacao,
            processos.created_at,
            clientes.nome AS cliente
        FROM processos
        INNER JOIN clientes ON clientes.id = processos.cliente_id
        WHERE processos.empresa_id = ?
        ORDER BY processos.created_at DESC
`;

    db.query(sql, [empresaId], (err, result) => {

        if (err) return res.status(500).json({ msg: 'Erro ao listar processos', error: err.message });

        res.json(result);

    });

};

exports.obterProcesso = (req, res) => {
    const empresaId = req.user.empresaId;
    const { id } = req.params;

    const sql = `
        SELECT
            processos.*,
            clientes.nome AS cliente,
            clientes.cpf AS cliente_cpf,
            clientes.telefone AS cliente_telefone,
            clientes.email AS cliente_email,
            clientes.endereco AS cliente_endereco
        FROM processos
        INNER JOIN clientes ON clientes.id = processos.cliente_id
        WHERE processos.id = ? AND processos.empresa_id = ?
        LIMIT 1
    `;

    db.query(sql, [id, empresaId], (err, result) => {
        if (err) {
            return res.status(500).json({ msg: 'Erro ao carregar processo', error: err.message });
        }

        if (!result.length) {
            return res.status(404).json({ msg: 'Processo não encontrado' });
        }

        res.json(result[0]);
    });
};

exports.atualizarAndamento = (req, res) => {
    const empresaId = req.user.empresaId;
    const { id } = req.params;
    const {
        andamento_percentual,
        andamento_descricao,
        observacao,
        custo_extra,
        status,
        custo_processo,
        honorario_escritorio
    } = req.body || {};

    const percentual = normalizarPercentual(andamento_percentual);
    const descricao = andamento_descricao || null;
    const observ = observacao || null;
    const custoExtra = normalizarDecimal(custo_extra);
    const custoProcesso = custo_processo !== undefined ? normalizarDecimal(custo_processo) : null;
    const honorario = honorario_escritorio !== undefined ? normalizarDecimal(honorario_escritorio) : null;

    db.getConnection((connectionErr, connection) => {
        if (connectionErr) {
            return res.status(500).json({ msg: 'Erro ao acessar banco', error: connectionErr.message });
        }

        connection.beginTransaction((txErr) => {
            if (txErr) {
                connection.release();
                return res.status(500).json({ msg: 'Erro ao iniciar transação', error: txErr.message });
            }

            connection.query(
                'SELECT id FROM processos WHERE id = ? AND empresa_id = ? LIMIT 1',
                [id, empresaId],
                (checkErr, processoResult) => {
                    if (checkErr) {
                        return connection.rollback(() => {
                            connection.release();
                            return res.status(500).json({ msg: 'Erro ao validar processo', error: checkErr.message });
                        });
                    }

                    if (!processoResult.length) {
                        return connection.rollback(() => {
                            connection.release();
                            return res.status(404).json({ msg: 'Processo não encontrado' });
                        });
                    }

                    const atualizaCampos = `
                        UPDATE processos
                        SET
                            andamento_percentual = ?,
                            andamento_descricao = ?,
                            status = COALESCE(?, status),
                            custo_processo = COALESCE(?, custo_processo),
                            honorario_escritorio = COALESCE(?, honorario_escritorio),
                            data_ultima_movimentacao = NOW()
                        WHERE id = ? AND empresa_id = ?
                    `;

                    connection.query(
                        atualizaCampos,
                        [
                            percentual,
                            descricao,
                            status || null,
                            custoProcesso,
                            honorario,
                            id,
                            empresaId
                        ],
                        (updateErr) => {
                            if (updateErr) {
                                return connection.rollback(() => {
                                    connection.release();
                                    return res.status(500).json({ msg: 'Erro ao atualizar processo', error: updateErr.message });
                                });
                            }

                            connection.query(
                                `
                                    INSERT INTO processo_movimentos
                                    (processo_id, empresa_id, andamento_percentual, andamento_descricao, observacao, custo_extra)
                                    VALUES (?, ?, ?, ?, ?, ?)
                                `,
                                [id, empresaId, percentual, descricao, observ, custoExtra],
                                (movErr) => {
                                    if (movErr) {
                                        return connection.rollback(() => {
                                            connection.release();
                                            return res.status(500).json({ msg: 'Erro ao registrar andamento', error: movErr.message });
                                        });
                                    }

                                    connection.commit((commitErr) => {
                                        if (commitErr) {
                                            return connection.rollback(() => {
                                                connection.release();
                                                return res.status(500).json({ msg: 'Erro ao finalizar atualização', error: commitErr.message });
                                            });
                                        }

                                        connection.release();
                                        return res.json({ msg: 'Andamento atualizado com sucesso' });
                                    });
                                }
                            );
                        }
                    );
                }
            );
        });
    });
};

exports.listarAndamentos = (req, res) => {
    const empresaId = req.user.empresaId;
    const { id } = req.params;

    const sql = `
        SELECT
            id,
            andamento_percentual,
            andamento_descricao,
            observacao,
            custo_extra,
            created_at
        FROM processo_movimentos
        WHERE processo_id = ? AND empresa_id = ?
        ORDER BY created_at DESC
    `;

    db.query(sql, [id, empresaId], (err, result) => {
        if (err) {
            return res.status(500).json({ msg: 'Erro ao listar andamentos', error: err.message });
        }

        res.json(result);
    });
};

exports.atualizarProcesso = (req, res) => {
    const empresaId = req.user.empresaId;
    const { id } = req.params;
    const {
        numero_processo,
        cliente_id,
        tipo,
        status,
        andamento_percentual,
        andamento_descricao,
        custo_processo,
        honorario_escritorio,
        descricao,
        data_abertura
    } = req.body || {};

    if (!numero_processo || !cliente_id) {
        return res.status(400).json({ msg: 'Número do processo e cliente são obrigatórios' });
    }

    db.getConnection((connectionErr, connection) => {
        if (connectionErr) {
            return res.status(500).json({ msg: 'Erro ao acessar banco', error: connectionErr.message });
        }

        connection.beginTransaction((txErr) => {
            if (txErr) {
                connection.release();
                return res.status(500).json({ msg: 'Erro ao iniciar transação', error: txErr.message });
            }

            connection.query(
                'SELECT id FROM processos WHERE id = ? AND empresa_id = ? LIMIT 1',
                [id, empresaId],
                (checkErr, processoResult) => {
                    if (checkErr) {
                        return connection.rollback(() => {
                            connection.release();
                            return res.status(500).json({ msg: 'Erro ao validar processo', error: checkErr.message });
                        });
                    }

                    if (!processoResult.length) {
                        return connection.rollback(() => {
                            connection.release();
                            return res.status(404).json({ msg: 'Processo não encontrado' });
                        });
                    }

                    connection.query(
                        'SELECT id FROM clientes WHERE id = ? AND empresa_id = ? LIMIT 1',
                        [cliente_id, empresaId],
                        (clienteErr, clienteResult) => {
                            if (clienteErr) {
                                return connection.rollback(() => {
                                    connection.release();
                                    return res.status(500).json({ msg: 'Erro ao validar cliente', error: clienteErr.message });
                                });
                            }

                            if (!clienteResult.length) {
                                return connection.rollback(() => {
                                    connection.release();
                                    return res.status(404).json({ msg: 'Cliente não encontrado nesta empresa' });
                                });
                            }

                            const sql = `
                                UPDATE processos
                                SET
                                    numero_processo = ?,
                                    cliente_id = ?,
                                    tipo = ?,
                                    status = ?,
                                    andamento_percentual = ?,
                                    andamento_descricao = ?,
                                    custo_processo = ?,
                                    honorario_escritorio = ?,
                                    descricao = ?,
                                    data_abertura = ?,
                                    data_ultima_movimentacao = NOW()
                                WHERE id = ? AND empresa_id = ?
                            `;

                            connection.query(
                                sql,
                                [
                                    numero_processo.trim(),
                                    cliente_id,
                                    tipo || null,
                                    status || 'Em andamento',
                                    normalizarPercentual(andamento_percentual),
                                    andamento_descricao || null,
                                    normalizarDecimal(custo_processo),
                                    normalizarDecimal(honorario_escritorio),
                                    descricao || null,
                                    data_abertura || null,
                                    id,
                                    empresaId
                                ],
                                (updateErr) => {
                                    if (updateErr) {
                                        return connection.rollback(() => {
                                            connection.release();
                                            if (updateErr.code === 'ER_DUP_ENTRY') {
                                                return res.status(409).json({ msg: 'Número do processo já cadastrado nesta empresa' });
                                            }

                                            return res.status(500).json({ msg: 'Erro ao atualizar processo', error: updateErr.message });
                                        });
                                    }

                                    connection.commit((commitErr) => {
                                        if (commitErr) {
                                            return connection.rollback(() => {
                                                connection.release();
                                                return res.status(500).json({ msg: 'Erro ao finalizar atualização', error: commitErr.message });
                                            });
                                        }

                                        connection.release();
                                        return res.json({ msg: 'Processo atualizado com sucesso' });
                                    });
                                }
                            );
                        }
                    );
                }
            );
        });
    });
};

exports.excluirProcesso = (req, res) => {
    const empresaId = req.user.empresaId;
    const { id } = req.params;

    db.getConnection((connectionErr, connection) => {
        if (connectionErr) {
            return res.status(500).json({ msg: 'Erro ao acessar banco', error: connectionErr.message });
        }

        connection.beginTransaction((txErr) => {
            if (txErr) {
                connection.release();
                return res.status(500).json({ msg: 'Erro ao iniciar transação', error: txErr.message });
            }

            connection.query(
                'SELECT id FROM processos WHERE id = ? AND empresa_id = ? LIMIT 1',
                [id, empresaId],
                (checkErr, processoResult) => {
                    if (checkErr) {
                        return connection.rollback(() => {
                            connection.release();
                            return res.status(500).json({ msg: 'Erro ao validar processo', error: checkErr.message });
                        });
                    }

                    if (!processoResult.length) {
                        return connection.rollback(() => {
                            connection.release();
                            return res.status(404).json({ msg: 'Processo não encontrado' });
                        });
                    }

                    connection.query(
                        'DELETE FROM processo_movimentos WHERE processo_id = ? AND empresa_id = ?',
                        [id, empresaId],
                        (movErr) => {
                            if (movErr) {
                                return connection.rollback(() => {
                                    connection.release();
                                    return res.status(500).json({ msg: 'Erro ao excluir histórico do processo', error: movErr.message });
                                });
                            }

                            connection.query(
                                'DELETE FROM processos WHERE id = ? AND empresa_id = ?',
                                [id, empresaId],
                                (deleteErr, deleteResult) => {
                                    if (deleteErr) {
                                        return connection.rollback(() => {
                                            connection.release();
                                            return res.status(500).json({ msg: 'Erro ao excluir processo', error: deleteErr.message });
                                        });
                                    }

                                    if (!deleteResult.affectedRows) {
                                        return connection.rollback(() => {
                                            connection.release();
                                            return res.status(404).json({ msg: 'Processo não encontrado' });
                                        });
                                    }

                                    connection.commit((commitErr) => {
                                        if (commitErr) {
                                            return connection.rollback(() => {
                                                connection.release();
                                                return res.status(500).json({ msg: 'Erro ao finalizar exclusão', error: commitErr.message });
                                            });
                                        }

                                        connection.release();
                                        return res.json({ msg: 'Processo excluído com sucesso' });
                                    });
                                }
                            );
                        }
                    );
                }
            );
        });
    });
};
