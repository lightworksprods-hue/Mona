const { validationResult } = require('express-validator');

// Validation error handler middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed.',
      errors: errors.array().map(err => ({ field: err.path || err.param, message: err.msg })),
    });
  }
  next();
};

// Global error handler
const errorHandler = (err, req, res, next) => {
  console.error('Unhandled Server Error:', err);

  // Prisma unique constraint violation
  if (err.code === 'P2002') {
    const target = err.meta?.target ? err.meta.target.join(', ') : 'field';
    return res.status(409).json({
      success: false,
      message: `A record with this ${target} already exists.`,
    });
  }

  // Prisma record not found
  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      message: 'Requested record was not found in database.',
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error occurred.',
  });
};

module.exports = {
  validate,
  errorHandler,
};
