const errorMiddleware = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;

    res.status(statusCode).json({
        statusCode,
        data: null,
        message: err.message,
        errors: err.errors || [],
        success: false,
    });
};

export default errorMiddleware;
