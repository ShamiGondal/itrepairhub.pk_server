import http from 'http';
import { config as loadEnv } from 'dotenv';
import app from './app.js';

loadEnv();

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);

server.listen(PORT, () => {
  // Simple startup log; in production you'd use a proper logger
  console.log(`IT Repair Hub Backend API running on port ${PORT}`);
});

export default server;


