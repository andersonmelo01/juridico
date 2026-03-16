const jwt = require('jsonwebtoken')

exports.login = (req, res) => {

    const { email, senha } = req.body

    // usuário de teste
    if (email === "admin@admin.com" && senha === "123456") {

        const token = jwt.sign(
            { id: 1, nome: "Administrador" },
            "segredo",
            { expiresIn: "8h" }
        )

        return res.json({ token })

    }

    res.status(401).json({ msg: "Usuário ou senha inválidos" })

}
