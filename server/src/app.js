import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './shared/middleware/error.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (env.corsOrigins.includes('*')) return callback(null, true);
      if (env.corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: false,
  })
);

// increase payload limits for Excel-import JSON bodies
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'BCVS API is running',
  });
});

function resolveVerifierWebBase(req) {
  const configured = String(
    process.env.VERIFICATION_WEB_BASE_URL ||
      process.env.WEB_BASE_URL ||
      ''
  )
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/verification-portal\/verify$/i, '')
    .replace(/\/verification-portal$/i, '')
    .replace(/\/verify$/i, '');

  if (configured) return configured;

  const host = String(req.get('host') || 'localhost:5000').replace(/:\d+$/, ':5173');
  return `${req.protocol}://${host}`;
}

function legacyVerifierPortalRedirect(req, res) {
  const sessionId = req.params.sessionId || '';
  const queryIndex = req.originalUrl.indexOf('?');
  const query = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : '';
  const targetPath = sessionId
    ? `/verify/${encodeURIComponent(sessionId)}`
    : '/verify';

  res.redirect(302, `${resolveVerifierWebBase(req)}${targetPath}${query}`);
}

app.get('/verification-portal/verify', legacyVerifierPortalRedirect);
app.get('/verification-portal/verify/:sessionId', legacyVerifierPortalRedirect);

app.use('/api', routes);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;


