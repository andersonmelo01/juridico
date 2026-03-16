const db = require('../config/database');

exports.criarProcesso = (req, res) => {

    const { numero_processo, cliente_id, tipo, status, descricao, data_abertura } = req.body;

    const sql = `
INSERT INTO processos 
(numero_processo,cliente_id,tipo,status,descricao,data_abertura)
VALUES (?,?,?,?,?,?)`;

    db.query(sql, [numero_processo, cliente_id, tipo, status, descricao, data_abertura], (err, result) => {

        if (err) return res.status(500).json(err);

        res.json({ msg: "Processo cadastrado" });

    });

};

exports.listarProcessos = (req, res) => {

    const sql = `
SELECT processos.*, clientes.nome as cliente
FROM processos
JOIN clientes ON clientes.id = processos.cliente_id
`;

    db.query(sql, (err, result) => {

        if (err) return res.status(500).json(err);

        res.json(result);

    });

};
