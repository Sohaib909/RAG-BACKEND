import express from 'express';
import dotenv from 'dotenv';
import { ensureCollection } from './services/qdrant.service.js';
import ragRouter from './routes/rag.routes.js';
import { errorHandler } from './middlewares/errorHandler.middleware.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/api/rag', ragRouter);

// Global error handler (must be last)
app.use(errorHandler);

app.listen(PORT, async () => {
    await ensureCollection();
    console.log(`Server is running on port ${PORT}`);
});