const express = require('express');
const router = express.Router();

/*router.post('/login', (req, res) => {
    res.json({ mensagem: "Rota de login funcionando" });
});*/

const authController = require('../controllers/authController')

router.post('/login', authController.login)

module.exports = router;
