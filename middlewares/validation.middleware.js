import { body, param, validationResult } from 'express-validator';

// Middleware to handle validation errors
export const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    next();
};

// Validation rules for chat endpoint
export const validateChat = [
    body('question')
        .trim()
        .notEmpty()
        .withMessage('Question is required')
        .isString()
        .withMessage('Question must be a string')
        .isLength({ min: 1, max: 1000 })
        .withMessage('Question must be between 1 and 1000 characters'),
    body('sessionId')
        .optional()
        .isUUID()
        .withMessage('Session ID must be a valid UUID'),
    handleValidationErrors
];

// Validation rules for getting session
export const validateGetSession = [
    param('sessionId')
        .notEmpty()
        .withMessage('Session ID is required')
        .isUUID()
        .withMessage('Session ID must be a valid UUID'),
    handleValidationErrors
];

// Middleware to validate file upload
export const validateFileUpload = (req, res, next) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            error: 'No file uploaded'
        });
    }
    next();
};
