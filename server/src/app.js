import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './shared/middleware/error.middleware.js';
import { buildDeploymentInfo } from './shared/utils/networkInfo.js';
import { getSystemSettingModel } from './modules/settings/setting.model.js';

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

function normalizeVerifierWebBase(value) {
  return String(value || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/verification-portal\/verify$/i, '')
    .replace(/\/verification-portal$/i, '')
    .replace(/\/verify$/i, '');
}

async function loadPersistedNetworkSettings() {
  try {
    const SystemSetting = getSystemSettingModel();
    const settings = await SystemSetting.findOne({ code: 'main' }, { network: 1 }).lean();
    return settings?.network || {};
  } catch {
    return {};
  }
}

async function resolveVerifierWebBase(req) {
  const networkSettings = await loadPersistedNetworkSettings();
  const deployment = buildDeploymentInfo(networkSettings);
  const configured = [
    env.verificationWebBaseUrl,
    env.domainWebBaseUrl || (env.publicDomain ? `https://${env.publicDomain}` : ''),
    networkSettings.domainWebBaseUrl,
    env.publicDomain ? `https://${env.publicDomain}` : '',
    env.webBaseUrl,
  ]
    .map(normalizeVerifierWebBase)
    .find(Boolean);

  if (configured) return configured;

  const lanWebBaseUrl =
    deployment.manualWebBaseUrl ||
    deployment.lanWebBaseUrls[0] ||
    deployment.preferredWebBaseUrl ||
    '';
  if (lanWebBaseUrl) return lanWebBaseUrl;

  const host = String(req.get('host') || 'localhost:5000').replace(/:\d+$/, `:${env.webPort || 5173}`);
  return `${req.protocol}://${host}`;
}

async function legacyVerifierPortalRedirect(req, res) {
  const sessionId = req.params.sessionId || '';
  const queryIndex = req.originalUrl.indexOf('?');
  const query = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : '';
  const targetPath = sessionId
    ? `/verify/${encodeURIComponent(sessionId)}`
    : '/verify';

  const webBase = await resolveVerifierWebBase(req);
  res.redirect(302, `${webBase}${targetPath}${query}`);
}

app.get('/verify', legacyVerifierPortalRedirect);
app.get('/verify/:sessionId', legacyVerifierPortalRedirect);
app.get('/verification-portal/verify', legacyVerifierPortalRedirect);
app.get('/verification-portal/verify/:sessionId', legacyVerifierPortalRedirect);

app.use('/api', routes);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;


