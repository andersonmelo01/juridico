const express = require('express');
const router = express.Router();

const auth = require('../middleware/authMiddleware');
const platformAdmin = require('../middleware/platformAdminMiddleware');
const adminController = require('../controllers/adminController');

router.get('/resumo', auth, platformAdmin, adminController.resumo);
router.get('/empresas', auth, platformAdmin, adminController.listarEmpresas);
router.post('/empresas', auth, platformAdmin, adminController.criarEmpresa);
router.put('/empresas/:id', auth, platformAdmin, adminController.atualizarEmpresa);
router.put('/empresas/:id/licenca', auth, platformAdmin, adminController.atualizarLicenca);
router.delete('/empresas/:id', auth, platformAdmin, adminController.excluirEmpresa);
router.post('/empresas/:id/usuarios', auth, platformAdmin, adminController.criarUsuarioEmpresa);
router.get('/empresas/:id/usuarios', auth, platformAdmin, adminController.listarUsuariosEmpresa);
router.put('/empresas/:id/usuarios/:usuarioId', auth, platformAdmin, adminController.atualizarUsuarioEmpresa);
router.delete('/empresas/:id/usuarios/:usuarioId', auth, platformAdmin, adminController.excluirUsuarioEmpresa);
router.get('/pre-cadastros', auth, platformAdmin, adminController.listarPreCadastros);
router.get('/planos', auth, platformAdmin, adminController.listarPlanos);
router.post('/planos', auth, platformAdmin, adminController.criarPlano);
router.post('/empresas/:id/aprovar', auth, platformAdmin, adminController.aprovarEmpresa);
router.post('/empresas/:id/rejeitar', auth, platformAdmin, adminController.rejeitarEmpresa);

module.exports = router;
