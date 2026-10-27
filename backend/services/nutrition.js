// USDA FoodData Central values for the 101 dishes, built by scripts/build_nutrition.py.
const foods = require('../data/nutrition.json');

const round = (n) => Math.round(n * 10) / 10;

exports.foods = foods;

exports.describe = (key) => {
    const f = foods[key];
    return f && { food: key, name: f.name, per100g: f.per100g, portions: f.portions, approximate: f.approximate, source: f.source };
};

exports.forGrams = (key, grams) => {
    const p = foods[key].per100g;
    return {
        kcal: Math.round((p.kcal * grams) / 100),
        protein: round((p.protein * grams) / 100),
        carbs: round((p.carbs * grams) / 100),
        fat: round((p.fat * grams) / 100),
    };
};
