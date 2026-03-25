const express = require('express');
const router = express.Router();

const clienteController = require('../controllers/clienteController');
const auth = require('../middleware/authMiddleware');
const empresaMiddleware = require('../middleware/empresaMiddleware');

router.post('/', auth, empresaMiddleware, clienteController.criarCliente);
router.get('/', auth, empresaMiddleware, clienteController.listarClientes);
router.get('/:id/processos', auth, empresaMiddleware, clienteController.listarHistoricoProcessosCliente);
router.get('/:id', auth, empresaMiddleware, clienteController.obterCliente);
router.put('/:id', auth, empresaMiddleware, clienteController.atualizarCliente);
router.delete('/:id', auth, empresaMiddleware, clienteController.excluirCliente);

module.exports = router;
