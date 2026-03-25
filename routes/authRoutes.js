const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController')
const auth = require('../middleware/authMiddleware');

router.get('/empresas', authController.listarEmpresas)
router.get('/planos', authController.listarPlanos)
router.post('/register', authController.register)
router.post('/login', authController.login)
router.post('/master-login', authController.masterLogin)
router.get('/me', auth, authController.me)

module.exports = router;
