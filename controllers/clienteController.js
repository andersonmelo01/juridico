const db = require('../config/database');

exports.criarCliente = (req, res) => {

    const { nome, cpf, telefone, email, endereco } = req.body;

    const sql = "INSERT INTO clientes (nome,cpf,telefone,email,endereco) VALUES (?,?,?,?,?)";

    db.query(sql, [nome, cpf, telefone, email, endereco], (err, result) => {

        if (err) return res.status(500).json(err);

        res.json({ msg: "Cliente criado" });
    });

};

exports.listarClientes = (req, res) => {

    db.query("SELECT * FROM clientes", (err, result) => {

        if (err) return res.status(500).json(err);

        res.json(result);

    });

};
