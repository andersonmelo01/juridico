module.exports = (req, res, next) => {
    if (!req.user || req.user.role !== 'platform_admin') {
        return res.status(403).json({ msg: 'Acesso restrito à administração da plataforma' });
    }

    return next();
};
