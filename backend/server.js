require('dotenv').config();
const connectDB = require('./config/db');
const app = require('./app');

const PORT = process.env.PORT || 5500;

if (!process.env.JWT_SECRET) {
    console.error('Set JWT_SECRET in backend/.env (any long random string), or run `npm run demo`.');
    process.exit(1);
}

connectDB().then(() => {
    app.listen(PORT, () => console.log(`CalTrack running on http://127.0.0.1:${PORT}`));
});
