// Zero-setup run: an in-memory MongoDB and a throwaway JWT secret. Data is gone when you stop it.
const crypto = require('crypto');
const { MongoMemoryServer } = require('mongodb-memory-server');

(async () => {
    const mongo = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongo.getUri();
    process.env.JWT_SECRET ||= crypto.randomBytes(32).toString('hex');
    require('./server');
})();
