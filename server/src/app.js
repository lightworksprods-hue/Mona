const express = require('express');
const cors = require('cors');
const { errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const saleRoutes = require('./routes/saleRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const reportRoutes = require('./routes/reportRoutes');
const cashRoutes = require('./routes/cashRoutes');

const app = express();

// Middlewares
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-ID'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Lightweight health checks for Render and Better Stack. These intentionally
// do not query the database so monitoring can distinguish app uptime from DB health.
const healthCheck = (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.status(200).json({
    status: 'ok',
    service: 'mona-pos-api',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
};

app.get('/health', healthCheck);
app.get('/api/health', healthCheck);

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/cash', cashRoutes);
app.use('/api', reportRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint ${req.method} ${req.originalUrl} not found`,
  });
});

// Centralized Error Handling Middleware
app.use(errorHandler);

module.exports = app;
