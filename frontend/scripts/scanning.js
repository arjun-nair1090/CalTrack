document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('camera'); // Video element
    const canvas = document.getElementById('snapshot'); // Hidden canvas element
    const context = canvas?.getContext('2d'); // Canvas context
    const captureButton = document.getElementById('capture-btn'); // Scan button
    const loader = document.getElementById('loader'); // Loading spinner
    const resultsDiv = document.getElementById('results'); // Results container
    const caloriesEl = document.getElementById('calories'); // Calories result
    const proteinEl = document.getElementById('protein'); // Protein result
    const fatEl = document.getElementById('fat'); // Fat result

    // Ensure the canvas and video elements are present
    if (!canvas || !context || !video) {
        console.error('Required elements (canvas or video) are missing in the DOM.');
        return;
    }

    // Function to start the live video feed
    async function startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = stream;
            console.log('Camera started successfully');
        } catch (error) {
            console.error('Camera error:', error);
            alert('Unable to access the camera. Please check your permissions.');
        }
    }

    // Function to capture the current frame and send it for analysis
    async function captureAndAnalyze() {
        // Disable button and show loader
        captureButton.disabled = true;
        loader.style.display = 'block';
        resultsDiv.style.display = 'none'; // Hide results while loading

        // Ensure the video has loaded before capturing the frame
        if (!video.videoWidth || !video.videoHeight) {
            console.error('Video is not ready yet.');
            alert('Video is not ready yet. Please try again.');
            captureButton.disabled = false;
            loader.style.display = 'none';
            return;
        }

        // Set canvas size to match the video dimensions
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw the current video frame onto the canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert the canvas content to a Blob
        canvas.toBlob(async (blob) => {
            if (!blob) {
                console.error('Failed to create Blob from canvas.');
                alert('Unable to process the image. Please try again.');
                captureButton.disabled = false;
                loader.style.display = 'none';
                return;
            }

            const formData = new FormData();
            formData.append('image', blob, 'snapshot.jpg');

            try {
                // Send the image to the backend for analysis
                const response = await fetch('/api/food/analyze', {
                    method: 'POST',
                    body: formData,
                });

                // Parse the response
                const result = await response.json();
                console.log('Backend response:', result);

                if (response.ok && result.data) {
                    // Display the results
                    caloriesEl.textContent = `Calories: ${result.data.calories}`;
                    proteinEl.textContent = `Protein: ${result.data.protein}g`;
                    fatEl.textContent = `Fat: ${result.data.fat}g`;
                    resultsDiv.style.display = 'block'; // Show the results section
                } else {
                    console.error('Analysis error:', result.message);
                    alert(result.message || 'Failed to analyze the food. Please try again.');
                }
            } catch (error) {
                console.error('Error during analysis:', error);
                alert('An error occurred while analyzing the image. Please try again.');
            } finally {
                // Re-enable button and hide loader
                captureButton.disabled = false;
                loader.style.display = 'none';
            }
        });
    }

    // Attach click event to the capture button
    captureButton.addEventListener('click', (event) => {
        event.preventDefault(); // Prevent default button behavior
        captureAndAnalyze();
    });

    // Start the camera feed
    startCamera();
});
