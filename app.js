const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const clienteRoutes = require('./routes/clienteRoutes');
const processoRoutes = require('./routes/processoRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

/*app.get('/', (req, res) => {
    res.send('API do Sistema Jurídico funcionando');
});*/

app.use('/auth', authRoutes);
app.use('/clientes', clienteRoutes);
app.use('/processos', processoRoutes);

module.exports = app;
