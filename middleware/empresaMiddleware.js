module.exports = (req, res, next) => {
    if (!req.user || !req.user.empresaId) {
        return res.status(403).json({ msg: 'Empresa não identificada no token' });
    }

    return next();
};
