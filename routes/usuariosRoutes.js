const express = require('express');
const router = express.Router();

const auth = require('../middleware/authMiddleware');
const empresaMiddleware = require('../middleware/empresaMiddleware');
const officeAdmin = require('../middleware/officeAdminMiddleware');
const usuariosController = require('../controllers/usuariosController');

router.get('/', auth, empresaMiddleware, officeAdmin, usuariosController.listarUsuarios);
router.post('/', auth, empresaMiddleware, officeAdmin, usuariosController.criarUsuario);
router.put('/:id', auth, empresaMiddleware, officeAdmin, usuariosController.atualizarUsuario);
router.delete('/:id', auth, empresaMiddleware, officeAdmin, usuariosController.excluirUsuario);

module.exports = router;
