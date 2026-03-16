const express = require('express');
const router = express.Router();

const clienteController = require('../controllers/clienteController');
const auth = require('../middleware/authMiddleware');

router.post('/', auth, clienteController.criarCliente);
router.get('/', auth, clienteController.listarClientes);

module.exports = router;
