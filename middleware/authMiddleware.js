const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {

    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ msg: "Token não fornecido" });
    }

    const parts = authHeader.split(' ');

    if (parts.length !== 2) {
        return res.status(401).json({ msg: "Token mal formatado" });
    }

    const [scheme, token] = parts;

    if (!/^Bearer$/i.test(scheme)) {
        return res.status(401).json({ msg: "Token mal formatado" });
    }

    try {

        const decoded = jwt.verify(token, "segredo");

        req.userId = decoded.id;

        return next();

    } catch (err) {

        return res.status(401).json({ msg: "Token inválido" });

    }

};
