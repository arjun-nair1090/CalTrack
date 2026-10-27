// Shared by login.html and signup.html: the form says which endpoint it posts to.
const form = document.querySelector('form');
const error = form.querySelector('.error');
const button = form.querySelector('button');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.textContent = '';
    button.disabled = true;
    try {
        const res = await fetch(form.dataset.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.fromEntries(new FormData(form))),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.message);
        localStorage.setItem('token', body.token);
        location.href = 'app';
    } catch (err) {
        error.textContent = err.message || 'Couldn’t reach CalTrack. Check the server is running.';
        button.disabled = false;
    }
});
