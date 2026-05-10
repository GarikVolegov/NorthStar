// Setup globale per tutti i test
// Silenzia i log Pino durante i test
process.env.LOG_LEVEL = 'silent';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-32-chars-minimum!';
process.env.ADMIN_KEY = 'test-admin-key';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/northstar_test';
process.env.AI_AGENTS_URL = 'http://localhost:8000';
