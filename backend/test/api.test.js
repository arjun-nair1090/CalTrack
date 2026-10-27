const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret';
const app = require('../app');

const MODEL = path.join(__dirname, '../model/food101-effnetb2.onnx');
let mongo, token;

before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    const res = await request(app).post('/api/auth/signup')
        .send({ name: 'Ada', email: 'ada@example.com', password: 'correct horse' });
    assert.equal(res.status, 201);
    token = res.body.token;
});

after(async () => {
    await mongoose.disconnect();
    await mongo.stop();
});

const authed = (req) => req.set('Authorization', `Bearer ${token}`);

test('rejects weak signups and wrong passwords', async () => {
    assert.equal((await request(app).post('/api/auth/signup').send({ name: 'B', email: 'b@x.io', password: 'short' })).status, 400);
    assert.equal((await request(app).post('/api/auth/signup').send({ name: 'Ada', email: 'ADA@example.com', password: 'correct horse' })).status, 409);
    assert.equal((await request(app).post('/api/auth/login').send({ email: 'ada@example.com', password: 'wrong one' })).status, 401);
    assert.equal((await request(app).post('/api/auth/login').send({ email: 'ada@example.com', password: 'correct horse' })).status, 200);
});

test('everything but signup and login needs a token', async () => {
    for (const url of ['/api/auth/me', '/api/food', '/api/meals?day=2026-10-27']) {
        assert.equal((await request(app).get(url)).status, 401, url);
    }
    assert.equal((await request(app).get('/api/meals?day=2026-10-27').set('Authorization', 'Bearer forged')).status, 401);
});

test('lists all 101 dishes with USDA sources', async () => {
    const res = await authed(request(app).get('/api/food'));
    assert.equal(res.body.length, 101);
    const pizza = res.body.find((f) => f.food === 'pizza');
    assert.ok(pizza.per100g.kcal > 200 && pizza.per100g.kcal < 320);
    assert.ok(res.body.every((f) => f.source.length && f.source.every((s) => s.fdcId) && f.portions.length));
});

test('the diary computes nutrition on the server and totals the day', async () => {
    const day = '2026-10-27';
    const a = await authed(request(app).post('/api/meals')).send({ food: 'pizza', grams: 200, day, kcal: 1 });
    assert.equal(a.status, 201);
    const per100 = require('../data/nutrition.json').pizza.per100g.kcal;
    assert.equal(a.body.kcal, Math.round(per100 * 2)); // the client's kcal: 1 is ignored
    await authed(request(app).post('/api/meals')).send({ food: 'hamburger', grams: 145, day });
    await authed(request(app).post('/api/meals')).send({ food: 'sushi', grams: 100, day: '2026-10-26' });

    const res = await authed(request(app).get(`/api/meals?day=${day}`));
    assert.equal(res.body.meals.length, 2);
    assert.equal(res.body.totals.kcal, res.body.meals[0].kcal + res.body.meals[1].kcal);

    assert.equal((await authed(request(app).delete(`/api/meals/${a.body._id}`))).status, 204);
    assert.equal((await authed(request(app).delete(`/api/meals/${a.body._id}`))).status, 404);
    assert.equal((await authed(request(app).get(`/api/meals?day=${day}`))).body.meals.length, 1);
});

test('rejects bad meals', async () => {
    for (const body of [{ food: 'cardboard', grams: 100, day: '2026-10-27' }, { food: 'pizza', grams: 0, day: '2026-10-27' }, { food: 'pizza', grams: 100, day: 'today' }]) {
        assert.equal((await authed(request(app).post('/api/meals')).send(body)).status, 400, JSON.stringify(body));
    }
});

test('users cannot see or delete each other’s meals', async () => {
    const other = (await request(app).post('/api/auth/signup').send({ name: 'Eve', email: 'eve@example.com', password: 'another one' })).body.token;
    const mine = (await authed(request(app).get('/api/meals?day=2026-10-27'))).body.meals[0];
    assert.equal((await request(app).delete(`/api/meals/${mine._id}`).set('Authorization', `Bearer ${other}`)).status, 404);
    assert.equal((await request(app).get('/api/meals?day=2026-10-27').set('Authorization', `Bearer ${other}`)).body.meals.length, 0);
});

test('daily target is validated', async () => {
    assert.equal((await authed(request(app).patch('/api/auth/me')).send({ dailyTarget: 100 })).status, 400);
    assert.equal((await authed(request(app).patch('/api/auth/me')).send({ dailyTarget: 2400 })).body.dailyTarget, 2400);
});

test('analyze needs an image', async () => {
    assert.equal((await authed(request(app).post('/api/food/analyze'))).status, 400);
    const res = await authed(request(app).post('/api/food/analyze')).attach('image', Buffer.from('not a picture'), { filename: 'x.jpg', contentType: 'image/jpeg' });
    assert.equal(res.status, 422);
});

test('analyze returns five ranked guesses with nutrition', { skip: !fs.existsSync(MODEL) && 'train the model first' }, async () => {
    const photo = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#c8742f' } }).jpeg().toBuffer();
    const res = await authed(request(app).post('/api/food/analyze')).attach('image', photo, 'plate.jpg');
    assert.equal(res.status, 200);
    assert.equal(res.body.predictions.length, 5);
    const c = res.body.predictions.map((p) => p.confidence);
    assert.deepEqual(c, [...c].sort((x, y) => y - x));
    assert.ok(res.body.predictions.every((p) => p.per100g));
});
