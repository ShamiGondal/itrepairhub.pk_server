export class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function createApiErrorHandler() {
  // Express error-handling middleware
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const response = {
      success: false,
      message: err.message || 'Internal Server Error',
    };

    if (err.details) {
      response.details = err.details;
    }

    if (process.env.NODE_ENV !== 'production') {
      response.stack = err.stack;
    }

    res.status(statusCode).json(response);
  };
}


