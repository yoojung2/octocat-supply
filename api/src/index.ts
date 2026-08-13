import express from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import deliveryRoutes from './routes/delivery';
import orderDetailDeliveryRoutes from './routes/orderDetailDelivery';
import productRoutes from './routes/product';
import orderDetailRoutes from './routes/orderDetail';
import orderRoutes from './routes/order';
import branchRoutes from './routes/branch';
import headquartersRoutes from './routes/headquarters';
import supplierRoutes from './routes/supplier';
import { initializeDatabase } from './init-db';
import { errorHandler } from './utils/errors';
import { requireApiKey } from './security/auth';
import { auditPrivilegedOperation } from './security/audit';
import { validateRequestBody } from './security/validation';

const port = process.env.PORT || 3000;

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Express API with Swagger',
      version: '1.0.0',
      description: 'REST API documentation using Swagger/OpenAPI',
    },
    servers: [
      {
        url: `http://localhost:${port}`,
        description: 'Development server (HTTP)',
      },
      {
        url: `https://localhost:${port}`,
        description: 'Development server (HTTPS)',
      },
    ],
  },
  apis: ['./src/models/*.ts', './src/routes/*.ts'],
};

function parseCorsOrigins(): string[] {
  return (process.env.API_CORS_ORIGINS || 'http://localhost:5137,http://localhost:3001,http://127.0.0.1:5137,http://127.0.0.1:3001')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin && !origin.includes('*'));
}

export function createApp(): express.Express {
  const app = express();
  const corsOrigins = parseCorsOrigins();

  app.use(helmet());
  app.use((req, _res, next) => {
    req.setTimeout(Number(process.env.REQUEST_TIMEOUT_MS || 30000));
    next();
  });

  app.use(
    cors({
      origin: corsOrigins,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
      credentials: process.env.API_CORS_CREDENTIALS === 'true',
    }),
  );

  app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: Number(process.env.API_RATE_LIMIT || 300),
    standardHeaders: true,
    legacyHeaders: false,
  }));

  const swaggerDocs = swaggerJsdoc(swaggerOptions);
  const swaggerEnabled = process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true';
  if (swaggerEnabled) {
    app.use('/api-docs', requireApiKey, swaggerUi.serve, swaggerUi.setup(swaggerDocs));
    app.get('/api-docs.json', requireApiKey, (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerDocs);
    });
  }

  app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '100kb' }));
  app.use('/api', requireApiKey, auditPrivilegedOperation, validateRequestBody);

  app.use('/api/deliveries', deliveryRoutes);
  app.use('/api/order-detail-deliveries', orderDetailDeliveryRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/order-details', orderDetailRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/branches', branchRoutes);
  app.use('/api/headquarters', headquartersRoutes);
  app.use('/api/suppliers', supplierRoutes);

  app.get('/', (req, res) => {
    res.send('Hello, world!');
  });

  app.use(errorHandler);

  return app;
}

// Initialize database and start server
async function startServer() {
  try {
    const app = createApp();
    console.log('🚀 Initializing database...');
    await initializeDatabase(true); // Always attempt seeding - the seeder checks if it's needed
    console.log('✅ Database initialized successfully');

    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
      console.log(`API documentation is available at http://localhost:${port}/api-docs`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}
