const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const config = require('./config/config');
const {
  sequelize,
  User,
  Permit,
  Inspection,
  Document,
  Payment,
  Notification,
  Workflow,
  WorkflowStep,
  WorkflowExecution,
  Task
} = require('./models');

// Middleware imports
const { apiLimiter, authLimiter } = require('./middleware/rateLimiter');
const { requestLogger } = require('./middleware/auditLog');

const app = express();

// Validate configuration before starting
config.validateConfig();

// Trust proxy (important for rate limiting and getting correct IPs)
app.set('trust proxy', 1);

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS Configuration
app.use(cors({
  origin: config.security.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Sanitize data to prevent NoSQL injection (helps with similar attacks)
app.use(mongoSanitize());

// Prevent HTTP Parameter Pollution
app.use(hpp());

// Request logging and audit trail
app.use(requestLogger);

// Apply rate limiting to all API routes
app.use('/api/', apiLimiter);

// Route imports
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const permitRoutes = require('./routes/permits');
const dashboardRoutes = require('./routes/dashboard');
const inspectionRoutes = require('./routes/inspections');
const documentRoutes = require('./routes/documents');
const paymentRoutes = require('./routes/payments');
const notificationRoutes = require('./routes/notifications');
const aiRoutes = require('./routes/ai');
const workflowRoutes = require('./routes/workflows');
const analyticsRoutes = require('./routes/analytics');
const crmRoutes = require('./routes/crm');
const grantRoutes = require('./routes/grants');
const secureMeshRoutes = require('./routes/securemesh');
const publicEngagementRoutes = require('./routes/public-engagement');
const adminUpgradeRoutes = require('./routes/admin-upgrade');
const demoRoutes = require('./routes/demo');
const foiaRoutes = require('./routes/foia');

// Service imports
const aiService = require('./services/aiService');
const ocrService = require('./services/ocrService');

// Routes
// Auth routes get stricter rate limiting
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/permits', permitRoutes);
app.use('/api/inspections', inspectionRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/grants', grantRoutes);
app.use('/api/securemesh', secureMeshRoutes);
app.use('/api/public-engagement', publicEngagementRoutes);
app.use('/api/admin-upgrade', adminUpgradeRoutes); // TEMPORARY - Remove after upgrading user
app.use('/api/demo', demoRoutes); // Demo data seeding and info
app.use('/api/foia', foiaRoutes); // FOIA/Public Records Management

// Health check endpoint (no rate limiting)
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Govli AI Backend',
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
    version: '1.0.2' // Force redeploy with routes
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
    path: req.path
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);

  // Don't leak error details in production
  const errorResponse = {
    error: 'Internal Server Error',
    message: config.nodeEnv === 'development' ? err.message : 'Something went wrong'
  };

  if (config.nodeEnv === 'development') {
    errorResponse.stack = err.stack;
  }

  res.status(err.status || 500).json(errorResponse);
});

const PORT = config.port;

async function initDatabase() {
  try {
    console.log('🔄 Initializing database...');

    // Initialize AI services
    console.log('🤖 Initializing AI services...');
    await aiService.initialize();
    await ocrService.initialize();

    // Run one-time migration to fix column names
    const fixColumnNames = require('./migrations/fixColumnNames');
    await fixColumnNames();

    // Sync database schema with models
    // Migration handles column renaming, so we can use force: false
    await sequelize.sync({ force: false });
    console.log('✅ Database schema synchronized');

    // Log all synced models
    const models = Object.keys(sequelize.models);
    console.log(`✅ Database synced (${models.length} models)`);
    console.log(`   Models: ${models.join(', ')}`);

    // Create default admin user if it doesn't exist
    const adminExists = await User.findOne({ where: { email: 'admin@govli.ai' } });
    if (!adminExists) {
      await User.create({
        email: 'admin@govli.ai',
        password: 'Admin123$',
        name: 'System Administrator',
        role: 'admin'
      });
      console.log('✅ Admin user created (email: admin@govli.ai, password: Admin123$)');
    }

    // Create default staff user for testing
    if (config.nodeEnv === 'development') {
      const staffExists = await User.findOne({ where: { email: 'staff@govli.ai' } });
      if (!staffExists) {
        await User.create({
          email: 'staff@govli.ai',
          password: 'Staff123$',
          name: 'Staff User',
          role: 'staff'
        });
        console.log('✅ Staff user created (email: staff@govli.ai, password: Staff123$)');
      }

      // Create inspector user
      const inspectorExists = await User.findOne({ where: { email: 'inspector@govli.ai' } });
      if (!inspectorExists) {
        await User.create({
          email: 'inspector@govli.ai',
          password: 'Inspector123$',
          name: 'Inspector User',
          role: 'inspector'
        });
        console.log('✅ Inspector user created (email: inspector@govli.ai, password: Inspector123$)');
      }
    }

    console.log('✅ Database initialization complete');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    if (config.nodeEnv === 'production') {
      process.exit(1); // Exit in production on DB failure
    }
  }
}

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Govli AI Backend running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
});

module.exports = app;
