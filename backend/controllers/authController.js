const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const profile = (user) => ({ name: user.name, email: user.email, dailyTarget: user.dailyTarget });
const session = (user) => ({
    token: jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '7d' }),
    user: profile(user),
});

// Signup logic
exports.signup = async (req, res) => {
    const { name, email, password } = req.body || {};
    if (!name?.trim() || !EMAIL.test(email || '') || (password || '').length < 8) {
        return res.status(400).json({ message: 'Enter your name, a valid email and a password of at least 8 characters.' });
    }
    if (await User.exists({ email: email.toLowerCase().trim() })) {
        return res.status(409).json({ message: 'An account with that email already exists. Log in instead.' });
    }
    const user = await User.create({ name, email, password: await bcrypt.hash(password, 10) });
    res.status(201).json(session(user));
};

// Login logic
exports.login = async (req, res) => {
    const { email, password } = req.body || {};
    const user = await User.findOne({ email: (email || '').toLowerCase().trim() });
    if (!user || !(await bcrypt.compare(password || '', user.password))) {
        return res.status(401).json({ message: 'That email and password don’t match an account.' });
    }
    res.json(session(user));
};

exports.me = async (req, res) => {
    const user = await User.findById(req.userId);
    if (!user) return res.status(401).json({ message: 'Log in to continue.' });
    res.json(profile(user));
};

exports.updateMe = async (req, res) => {
    const target = Number(req.body?.dailyTarget);
    if (!Number.isInteger(target) || target < 800 || target > 6000) {
        return res.status(400).json({ message: 'Set a daily target between 800 and 6000 kcal.' });
    }
    const user = await User.findByIdAndUpdate(req.userId, { dailyTarget: target }, { new: true });
    res.json(profile(user));
};
