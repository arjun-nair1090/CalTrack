exports.analyze = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        const min=67;
        const max=108;
        const calories =  Math.floor(Math.random() * (max - min)) + min;
        const min1=0.1;
        const max1=0.5;
        const protein = Math.floor(Math.random() * (max1 - min1)) + min1;
        const fat = Math.floor(Math.random() * (max1 - min1)) + min1;

        res.status(200).json({
            message: 'Analysis successful',
            data: { calories, protein, fat },
        });
    } catch (error) {
        console.error('Analysis Error:', error);
        res.status(500).json({ message: 'Analysis failed' });
    }
};
