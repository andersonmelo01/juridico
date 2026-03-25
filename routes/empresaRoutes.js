const express = require('express');
const router = express.Router();

const auth = require('../middleware/authMiddleware');
const empresaMiddleware = require('../middleware/empresaMiddleware');
const empresaController = require('../controllers/empresaController');

router.get('/me', auth, empresaMiddleware, empresaController.obterEmpresaLogada);
router.put('/me', auth, empresaMiddleware, empresaController.atualizarEmpresaLogada);

module.exports = router;
