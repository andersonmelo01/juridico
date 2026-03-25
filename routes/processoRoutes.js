const express = require('express');
const router = express.Router();

const processoController = require('../controllers/processoController');
const auth = require('../middleware/authMiddleware');
const empresaMiddleware = require('../middleware/empresaMiddleware');

router.post('/', auth, empresaMiddleware, processoController.criarProcesso);
router.get('/', auth, empresaMiddleware, processoController.listarProcessos);
router.get('/:id', auth, empresaMiddleware, processoController.obterProcesso);
router.get('/:id/andamentos', auth, empresaMiddleware, processoController.listarAndamentos);
router.post('/:id/andamentos', auth, empresaMiddleware, processoController.atualizarAndamento);
router.put('/:id', auth, empresaMiddleware, processoController.atualizarProcesso);
router.delete('/:id', auth, empresaMiddleware, processoController.excluirProcesso);

module.exports = router;
