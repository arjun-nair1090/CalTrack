const token = localStorage.getItem('token');
if (!token) location.replace('login');

const $ = (id) => document.getElementById(id);
const g = (n) => `${Math.round(n * 10) / 10} g`;

async function api(path, options = {}) {
    const res = await fetch(path, { ...options, headers: { Authorization: `Bearer ${token}`, ...options.headers } });
    if (res.status === 401) {
        localStorage.removeItem('token');
        location.replace('login');
    }
    if (res.status === 204) return null;
    const body = await res.json();
    if (!res.ok) throw new Error(body.message);
    return body;
}

// The user's own calendar day, not UTC, so a late dinner lands on the right date.
const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
let day = new Date();
let foods = {};   // key -> { food, name, per100g, portions, approximate, source }
let chosen = null;
let me = null;

// ---------- picking a dish ----------

function choose(key) {
    chosen = foods[key];
    $('chosen').hidden = false;
    $('dish').textContent = chosen.name;
    $('portion').replaceChildren(...chosen.portions.map((p, i) => new Option(`${p.label} (${Math.round(p.grams)} g)`, i)));
    $('grams').value = Math.round(chosen.portions[0].grams);
    $('add-error').textContent = '';
    const sources = chosen.source.map((s) => `<a href="https://fdc.nal.usda.gov/food-details/${s.fdcId}/nutrients" target="_blank" rel="noopener">${s.description}</a>`);
    $('source').innerHTML = (chosen.approximate ? 'Approximate: blended from USDA FoodData Central ' : 'From USDA FoodData Central ') + sources.join(', ') + '.';
    preview();
}

function preview() {
    const grams = Number($('grams').value) || 0;
    const p = chosen.per100g;
    $('kcal').textContent = Math.round((p.kcal * grams) / 100);
    $('fat').textContent = g((p.fat * grams) / 100);
    $('carbs').textContent = g((p.carbs * grams) / 100);
    $('protein').textContent = g((p.protein * grams) / 100);
}

$('portion').addEventListener('change', () => {
    $('grams').value = Math.round(chosen.portions[$('portion').value].grams);
    preview();
});
$('grams').addEventListener('input', preview);

$('search').addEventListener('change', () => {
    const name = $('search').value.trim().toLowerCase();
    const hit = Object.values(foods).find((f) => f.name.toLowerCase() === name);
    if (hit) {
        document.querySelectorAll('#guesses input').forEach((r) => (r.checked = false));
        choose(hit.food);
    }
});

// ---------- the photo ----------

async function analyze(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const drop = $('drop');
    drop.style.backgroundImage = `url(${URL.createObjectURL(file)})`;
    drop.classList.add('has-photo');
    drop.querySelector('strong').textContent = 'Change photo';
    $('status').textContent = 'Looking at your photo…';
    $('guesses').replaceChildren();

    const form = new FormData();
    form.append('image', file);
    try {
        const { sure, predictions } = await api('/api/food/analyze', { method: 'POST', body: form });
        $('status').textContent = sure
            ? 'Here’s what it looks like. Change it if that’s wrong.'
            : 'Not sure about this one. Pick the closest dish or search for it.';
        $('guesses').replaceChildren(...predictions.map((p, i) => {
            const li = document.createElement('li');
            li.className = 'guess';
            li.innerHTML = `<label><input type="radio" name="guess" value="${p.food}"><span>${p.name}</span><span>${Math.round(p.confidence * 100)}%</span><span class="meter"><i style="width:${p.confidence * 100}%"></i></span></label>`;
            li.querySelector('input').checked = i === 0;
            return li;
        }));
        choose(predictions[0].food);
    } catch (err) {
        $('status').textContent = err.message;
    }
}

$('guesses').addEventListener('change', (e) => {
    $('search').value = '';
    choose(e.target.value);
});
$('photo').addEventListener('change', (e) => analyze(e.target.files[0]));
const drop = $('drop');
drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('dragging'); });
drop.addEventListener('dragleave', () => drop.classList.remove('dragging'));
drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('dragging');
    analyze(e.dataTransfer.files[0]);
});

// ---------- the diary ----------

async function loadDay() {
    const today = isoDay(new Date());
    const key = isoDay(day);
    $('day-title').textContent = key === today ? 'Today' : day.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    $('next').disabled = key >= today;

    const { meals, totals } = await api(`/api/meals?day=${key}`);
    $('day-kcal').textContent = totals.kcal.toLocaleString();
    $('day-fat').textContent = g(totals.fat);
    $('day-carbs').textContent = g(totals.carbs);
    $('day-protein').textContent = g(totals.protein);

    const target = me.dailyTarget;
    const left = target - totals.kcal;
    $('progress').querySelector('i').style.width = `${Math.min(100, (totals.kcal / target) * 100)}%`;
    $('progress').classList.toggle('over', left < 0);
    $('left').textContent = left >= 0 ? `${left.toLocaleString()} left of ${target.toLocaleString()}` : `${(-left).toLocaleString()} over your ${target.toLocaleString()} target`;

    $('meals').replaceChildren(...(meals.length ? meals.map((m) => {
        const row = document.createElement('div');
        row.className = 'row meal';
        row.innerHTML = `<span class="what"><b></b><small>${m.grams} g · ${g(m.protein)} protein</small></span><span>${m.kcal}<button type="button">Remove</button></span>`;
        row.querySelector('b').textContent = m.name;
        row.querySelector('button').addEventListener('click', async () => {
            await api(`/api/meals/${m._id}`, { method: 'DELETE' });
            loadDay();
        });
        return row;
    }) : [Object.assign(document.createElement('p'), { className: 'fine', textContent: 'Nothing logged yet. Add a meal to start the day.' })]));
}

$('add').addEventListener('click', async () => {
    $('add-error').textContent = '';
    try {
        await api('/api/meals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ food: chosen.food, grams: Number($('grams').value), day: isoDay(day) }),
        });
        loadDay();
    } catch (err) {
        $('add-error').textContent = err.message;
    }
});

$('prev').addEventListener('click', () => { day.setDate(day.getDate() - 1); loadDay(); });
$('next').addEventListener('click', () => { day.setDate(day.getDate() + 1); loadDay(); });

$('target').addEventListener('change', async () => {
    $('target-error').textContent = '';
    try {
        me = await api('/api/auth/me', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dailyTarget: Number($('target').value) }),
        });
        loadDay();
    } catch (err) {
        $('target-error').textContent = err.message;
        $('target').value = me.dailyTarget;
    }
});

$('logout').addEventListener('click', () => {
    localStorage.removeItem('token');
    location.href = '/';
});

(async () => {
    const [profile, list] = await Promise.all([api('/api/auth/me'), api('/api/food')]);
    me = profile;
    $('who').textContent = me.name;
    $('target').value = me.dailyTarget;
    foods = Object.fromEntries(list.map((f) => [f.food, f]));
    $('food-names').replaceChildren(...list.map((f) => new Option(f.name)));
    loadDay();
})();
