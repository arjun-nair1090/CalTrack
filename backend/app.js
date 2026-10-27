const express = require('express');
const path = require('path');
const multer = require('multer');

const app = express();

app.use(express.json({ limit: '20kb' }));
app.use(express.static(path.join(__dirname, '../frontend'), { extensions: ['html'] }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/food', require('./routes/food'));
app.use('/api/meals', require('./routes/meals'));

app.use('/api', (req, res) => res.status(404).json({ message: 'No such endpoint.' }));

// Express 5 forwards errors from async handlers here.
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(413).json({ message: 'That photo is over 10 MB. Try a smaller one.' });
    }
    if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'The request body isn’t valid JSON.' });
    console.error(err);
    res.status(500).json({ message: 'Something went wrong on our side. Try again.' });
});

module.exports = app;
