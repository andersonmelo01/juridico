const express = require('express');
const router = express.Router();

const processoController = require('../controllers/processoController');
const auth = require('../middleware/authMiddleware');

router.post('/', auth, processoController.criarProcesso);
router.get('/', auth, processoController.listarProcessos);

module.exports = router;
