import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 4000),
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/realtime_monitoring',
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  allowDegradedStartup: process.env.ALLOW_DEGRADED_STARTUP !== 'false',
};
