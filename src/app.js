import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import passport from 'passport';
import { config as loadEnv } from 'dotenv';
import { createApiErrorHandler } from './utils/errorHandler.js';
import { initDb } from './config/db.config.js';
import apiRouter from './routes/index.js';
import { configurePassport } from './config/passport.config.js';
import { initUploadThing } from './utils/uploadthing.js';

// Load environment variables early
loadEnv();

const app = express();

// Configure passport strategies (Google, etc.)
configurePassport();

// Initialize UploadThing (non-blocking, will warn if config missing)
initUploadThing();

// Core middlewares tuned for API performance & SEO-friendly SSR consumers
// Configure Helmet with CORS-friendly settings
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration - Accept requests from multiple origins
// Support for comma-separated CORS_ORIGIN or wildcard '*'
const corsOriginHandler = (origin, callback) => {
  // If no CORS_ORIGIN env var or set to '*', allow all origins
  if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === '*') {
    return callback(null, true);
  }

  // Parse comma-separated origins
  const allowedOrigins = process.env.CORS_ORIGIN.split(',').map(o => o.trim());

  // Allow if origin is in the list or if request has no origin (e.g., Postman, server-to-server)
  if (!origin || allowedOrigins.includes(origin)) {
    return callback(null, true);
  }

  // Reject origin not in allowed list
  return callback(new Error('Not allowed by CORS'));
};

app.use(cors({
  origin: corsOriginHandler,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  optionsSuccessStatus: 200,
}));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

app.use(passport.initialize());

// Healthcheck (for uptime monitoring and SSR pre-flight checks)
app.get('/api/health', async (req, res) => {
  try {
    await initDb().then(pool => pool.query('SELECT 1'));
    res.status(200).json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});

// Main API router (Module 1: auth & user, plus future modules)
app.use('/v1', apiRouter);

// Centralized error handler
app.use(createApiErrorHandler());

export default app;


