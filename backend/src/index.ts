import express from 'express';
import cors from 'cors';
import iceRouter from './routes/ice';

const app = express();
const port = process.env.PORT || 3001;

// Enable CORS for your frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8080',
  credentials: true
}));

// Routes
app.use('/api', iceRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Backend server running on port ${port}`);
}); 