const path = require('path');
const ort = require('onnxruntime-node');
const sharp = require('sharp');

const MODEL = path.join(__dirname, '../model/food101-effnetb2.onnx');
const SIZE = 260;                       // must match model/train.py
const RESIZE = Math.floor(SIZE * 1.12); // shorter side before the centre crop, as in training
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

let session, labels; // loaded on first use, then reused
const getSession = async () => {
    labels ??= require('../model/labels.json');
    return (session ??= await ort.InferenceSession.create(MODEL));
};

// Same steps as the evaluation transform in train.py: shorter side to 291 px, centre
// crop 260, then ImageNet normalisation, laid out as 1x3xHxW floats. sharp only keeps
// the last resize in a chain, so the crop is done by hand.
async function toTensor(buffer) {
    const { data, info } = await sharp(buffer)
        .rotate() // respect the phone's EXIF orientation
        .resize(RESIZE, RESIZE, { fit: 'outside', kernel: 'linear' })
        .toColourspace('srgb')
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    const left = Math.round((info.width - SIZE) / 2);
    const top = Math.round((info.height - SIZE) / 2);
    const out = new Float32Array(3 * SIZE * SIZE);
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            const from = ((y + top) * info.width + (x + left)) * 3;
            for (let c = 0; c < 3; c++) {
                out[c * SIZE * SIZE + y * SIZE + x] = (data[from + c] / 255 - MEAN[c]) / STD[c];
            }
        }
    }
    return new ort.Tensor('float32', out, [1, 3, SIZE, SIZE]);
}

// Returns the model's best guesses, most likely first: [{ food, confidence }].
exports.classify = async (buffer, top = 5) => {
    let image;
    try {
        image = await toTensor(buffer);
    } catch (err) {
        throw Object.assign(err, { badImage: true });
    }
    const { probs } = await (await getSession()).run({ image });
    return Array.from(probs.data)
        .map((confidence, i) => ({ food: labels[i], confidence }))
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, top);
};
