const camera = document.getElementById('camera');
const captureBtn = document.getElementById('capture-btn');
const calorieOutput = document.getElementById('calorie-output').querySelector('span');
const proteinOutput = document.getElementById('protein-output').querySelector('span');
const fatOutput = document.getElementById('fat-output').querySelector('span');

// Access the user's camera
navigator.mediaDevices
    .getUserMedia({ video: true })
    .then((stream) => {
        camera.srcObject = stream;
    })
    .catch((error) => {
        console.error('Camera access denied:', error);
        alert('Unable to access the camera. Please check your permissions.');
    });

// Placeholder Analyze Function
function analyzeMeal() {
    // Simulate analysis and output (replace with AI integration)
    setTimeout(() => {
        calorieOutput.textContent = "540 kcal";
        proteinOutput.textContent = "25 g";
        fatOutput.textContent = "18 g";
    }, 2000);
}

// Handle capture button click
captureBtn.addEventListener('click', () => {
    alert('Analyzing your meal...');
    analyzeMeal();
});
