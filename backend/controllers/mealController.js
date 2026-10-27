const mongoose = require('mongoose');
const Meal = require('../models/Meal');
const nutrition = require('../services/nutrition');

const DAY = /^\d{4}-\d{2}-\d{2}$/;

exports.add = async (req, res) => {
    const { food, grams, day } = req.body || {};
    const g = Number(grams);
    if (!nutrition.foods[food]) return res.status(400).json({ message: 'Pick a dish from the list.' });
    if (!(g >= 1 && g <= 3000)) return res.status(400).json({ message: 'Enter a portion between 1 and 3000 g.' });
    if (!DAY.test(day || '')) return res.status(400).json({ message: 'The day must look like 2026-10-27.' });

    const meal = await Meal.create({
        user: req.userId, day, food, name: nutrition.foods[food].name, grams: Math.round(g), ...nutrition.forGrams(food, g),
    });
    res.status(201).json(meal);
};

// The diary for one day, with totals worked out here so every client agrees.
exports.forDay = async (req, res) => {
    const day = req.query.day;
    if (!DAY.test(day || '')) return res.status(400).json({ message: 'The day must look like 2026-10-27.' });
    const meals = await Meal.find({ user: req.userId, day }).sort({ createdAt: 1 }).lean();
    const totals = meals.reduce(
        (t, m) => ({ kcal: t.kcal + m.kcal, protein: t.protein + m.protein, carbs: t.carbs + m.carbs, fat: t.fat + m.fat }),
        { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    );
    for (const k of ['protein', 'carbs', 'fat']) totals[k] = Math.round(totals[k] * 10) / 10;
    res.json({ day, meals, totals });
};

exports.remove = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'That meal no longer exists.' });
    const { deletedCount } = await Meal.deleteOne({ _id: req.params.id, user: req.userId });
    if (!deletedCount) return res.status(404).json({ message: 'That meal no longer exists.' });
    res.status(204).end();
};
