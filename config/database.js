const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'admin',
    database: 'juridico'
});

connection.connect((err) => {
    if (err) {
        console.error("Erro ao conectar:", err);
    } else {
        console.log("MySQL conectado");
    }
});

module.exports = connection;
