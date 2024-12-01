document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('signup-form');
    const messageBox = document.getElementById('message-box');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const signupData = Object.fromEntries(formData);

        try {
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(signupData),
            });

            const result = await response.json();
            if (response.ok) {
                messageBox.textContent = 'Signup successful!';
                messageBox.style.color = 'green';
                form.reset();
            } else {
                messageBox.textContent = result.message || 'Signup failed.';
                messageBox.style.color = 'red';
            }
        } catch (error) {
            console.error('Signup Error:', error);
            messageBox.textContent = 'An error occurred. Please try again.';
            messageBox.style.color = 'red';
        }
    });
});
