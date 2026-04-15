import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './shared/middleware/error.middleware.js';

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (env.corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: false,
  })
);

// increase payload limits for Excel-import JSON bodies
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'BCVS API is running',
  });
});

app.use('/api', routes);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;