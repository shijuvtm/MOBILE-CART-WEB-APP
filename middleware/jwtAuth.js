const jwt = require('jsonwebtoken');

/**
 * Reads token from cookie 'token' or Authorization header and verifies it.
 * On success sets req.user = payload and calls next().
 * On failure responds with 401 (for APIs) or redirects to /login for browser flows.
 */
const verifyJWT = (req, res, next) => {
  try {
    const token = req.cookies?.token || (req.header('Authorization') || '').replace('Bearer ', '');
    if (!token) {
      // If you prefer JSON for API calls, do: return res.status(401).json({ error: 'Unauthorized' });
      return res.redirect('/login');
    }
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    console.error('JWT verify error:', err);
    return res.redirect('/login');
  }
};

/**
 * Optional authentication: if token exists and valid, populate req.user,
 * otherwise continue without error. Useful for public pages where user info is optional.
 */
const optionalAuth = (req, res, next) => {
  try {
    const token = req.cookies?.token || (req.header('Authorization') || '').replace('Bearer ', '');
    if (!token) return next();
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
  } catch (err) {
    // invalid token — ignore and continue as unauthenticated
    console.warn('Optional JWT invalid:', err.message);
  }
  next();
};

module.exports = {
  verifyJWT,
  optionalAuth
};
