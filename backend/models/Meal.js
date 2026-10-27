const mongoose = require('mongoose');

// Nutrition is worked out on the server when the meal is saved, so the diary never
// trusts numbers sent by the browser.
const mealSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    day: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // the user's local date
    food: { type: String, required: true },
    name: { type: String, required: true },
    grams: { type: Number, required: true, min: 1, max: 3000 },
    kcal: Number,
    protein: Number,
    carbs: Number,
    fat: Number,
    createdAt: { type: Date, default: Date.now },
});
mealSchema.index({ user: 1, day: 1 });

module.exports = mongoose.model('Meal', mealSchema);
