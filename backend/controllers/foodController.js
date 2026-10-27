const { classify } = require('../services/classifier');
const nutrition = require('../services/nutrition');

// Below this the app asks the user to confirm the dish instead of assuming the top guess.
const SURE = 0.5;

exports.analyze = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Choose a photo of your food first.' });
    }
    let guesses;
    try {
        guesses = await classify(req.file.buffer);
    } catch (err) {
        if (!err.badImage) throw err;
        return res.status(422).json({ message: 'That file couldn’t be read as an image. Try a JPEG or PNG.' });
    }
    res.json({
        sure: guesses[0].confidence >= SURE,
        predictions: guesses.map((g) => ({ ...nutrition.describe(g.food), confidence: Math.round(g.confidence * 1000) / 1000 })),
    });
};

// Every dish the model knows, for picking one by hand when the photo guess is wrong.
exports.list = (req, res) => {
    res.json(Object.keys(nutrition.foods).map(nutrition.describe));
};
