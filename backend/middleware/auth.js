const jwt = require('jsonwebtoken');

// Expects "Authorization: Bearer <token>" and puts the user's id on req.userId.
module.exports = (req, res, next) => {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ message: 'Log in to continue.' });
    }
    try {
        req.userId = jwt.verify(token, process.env.JWT_SECRET).sub;
        next();
    } catch {
        res.status(401).json({ message: 'Your session has expired. Log in again.' });
    }
};
