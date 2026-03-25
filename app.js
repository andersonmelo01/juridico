const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const empresaRoutes = require('./routes/empresaRoutes');
const clienteRoutes = require('./routes/clienteRoutes');
const processoRoutes = require('./routes/processoRoutes');
const usuariosRoutes = require('./routes/usuariosRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/empresa', empresaRoutes);
app.use('/clientes', clienteRoutes);
app.use('/processos', processoRoutes);
app.use('/usuarios', usuariosRoutes);

module.exports = app;
