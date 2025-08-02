const { body, param, query, validationResult } = require('express-validator');
const mongoose = require('mongoose');

// Helper function to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.path || error.param,
        message: error.msg,
        value: error.value
      })),
      timestamp: new Date().toISOString()
    });
  }
  next();
};

// Custom validators
const customValidators = {
  // Phone number validation (supports Indian and international formats)
  isValidPhone: (value) => {
    const phoneRegex = /^[+]?[\d\s\-\(\)]{10,15}$/;
    return phoneRegex.test(value);
  },
  
  // Employee ID format validation
  isValidEmployeeId: (value) => {
    const empIdRegex = /^[A-Z]{2,4}\d{4}$/;
    return empIdRegex.test(value);
  },
  
  // Time format validation (HH:MM)
  isValidTime: (value) => {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(value);
  },
  
  // Date not in future
  isNotFutureDate: (value) => {
    return new Date(value) <= new Date();
  },
  
  // Age validation (must be 18+)
  isValidAge: (value) => {
    const birthDate = new Date(value);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age >= 18 && age <= 70;
  },
  
  // Salary range validation
  isValidSalary: (value) => {
    return value >= 10000 && value <= 1000000;
  },
  
  // PAN card format validation
  isValidPAN: (value) => {
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return panRegex.test(value);
  },
  
  // Aadhaar card format validation
  isValidAadhaar: (value) => {
    const aadhaarRegex = /^\d{12}$/;
    return aadhaarRegex.test(value.replace(/\s/g, ''));
  },
  
  // IFSC code validation
  isValidIFSC: (value) => {
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    return ifscRegex.test(value);
  }
};

// Employee creation validation
const validateEmployee = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Name can only contain letters and spaces'),
  
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .toLowerCase(),
  
  body('phone')
    .custom(customValidators.isValidPhone)
    .withMessage('Please provide a valid phone number'),
  
  body('alternatePhone')
    .optional()
    .custom(customValidators.isValidPhone)
    .withMessage('Please provide a valid alternate phone number'),
  
  body('password')
    .isLength({ min: 6, max: 128 })
    .withMessage('Password must be between 6 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  
  body('role')
    .isIn(['waiter', 'cook', 'chef', 'cashier', 'cleaner', 'manager', 'supervisor', 'host', 'bartender', 'delivery-boy', 'security'])
    .withMessage('Invalid role specified'),
  
  body('department')
    .optional()
    .isIn(['kitchen', 'service', 'management', 'maintenance', 'security', 'delivery'])
    .withMessage('Invalid department specified'),
  
  body('salary.base')
    .isNumeric()
    .withMessage('Base salary must be a number')
    .custom(customValidators.isValidSalary)
    .withMessage('Salary must be between ₹10,000 and ₹10,00,000'),
  
  body('salary.overtime')
    .optional()
    .isNumeric()
    .withMessage('Overtime rate must be a number')
    .custom((value) => value >= 0)
    .withMessage('Overtime rate cannot be negative'),
  
  body('hourlyRate')
    .optional()
    .isNumeric()
    .withMessage('Hourly rate must be a number')
    .custom((value) => value >= 50 && value <= 5000)
    .withMessage('Hourly rate must be between ₹50 and ₹5000'),
  
  body('payrollType')
    .optional()
    .isIn(['monthly', 'weekly', 'daily', 'hourly'])
    .withMessage('Invalid payroll type'),
  
  body('contractType')
    .optional()
    .isIn(['permanent', 'temporary', 'contract', 'part-time'])
    .withMessage('Invalid contract type'),
  
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date of birth')
    .custom(customValidators.isValidAge)
    .withMessage('Employee must be between 18 and 70 years old'),
  
  body('gender')
    .optional()
    .isIn(['male', 'female', 'other'])
    .withMessage('Invalid gender specified'),
  
  body('maritalStatus')
    .optional()
    .isIn(['single', 'married', 'divorced', 'widowed'])
    .withMessage('Invalid marital status'),
  
  body('bloodGroup')
    .optional()
    .isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
    .withMessage('Invalid blood group'),
  
  body('shiftTiming.startTime')
    .optional()
    .custom(customValidators.isValidTime)
    .withMessage('Please provide valid start time in HH:MM format'),
  
  body('shiftTiming.endTime')
    .optional()
    .custom(customValidators.isValidTime)
    .withMessage('Please provide valid end time in HH:MM format'),
  
  body('shiftTiming.breakDuration')
    .optional()
    .isInt({ min: 0, max: 480 })
    .withMessage('Break duration must be between 0 and 480 minutes'),
  
  body('shiftTiming.weeklyOffs')
    .optional()
    .isArray()
    .withMessage('Weekly offs must be an array'),
  
  body('shiftTiming.weeklyOffs.*')
    .optional()
    .isIn(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
    .withMessage('Invalid day specified in weekly offs'),
  
  body('address.pincode')
    .optional()
    .matches(/^\d{6}$/)
    .withMessage('Please provide a valid 6-digit pincode'),
  
  body('emergencyContact.phone')
    .optional()
    .custom(customValidators.isValidPhone)
    .withMessage('Please provide a valid emergency contact phone number'),
  
  body('documents.aadhar')
    .optional()
    .custom(customValidators.isValidAadhaar)
    .withMessage('Please provide a valid Aadhaar number'),
  
  body('documents.pan')
    .optional()
    .custom(customValidators.isValidPAN)
    .withMessage('Please provide a valid PAN number'),
  
  body('bankDetails.ifscCode')
    .optional()
    .custom(customValidators.isValidIFSC)
    .withMessage('Please provide a valid IFSC code'),
  
  body('bankDetails.accountNumber')
    .optional()
    .isLength({ min: 9, max: 18 })
    .withMessage('Account number must be between 9 and 18 digits')
    .isNumeric()
    .withMessage('Account number must contain only digits'),
  
  body('skills')
    .optional()
    .isArray()
    .withMessage('Skills must be an array'),
  
  body('skills.*')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Each skill must be between 2 and 50 characters'),
  
  body('experience.total')
    .optional()
    .isInt({ min: 0, max: 50 })
    .withMessage('Total experience must be between 0 and 50 years'),
  
  handleValidationErrors
];

// Employee update validation (less strict than creation)
const validateEmployeeUpdate = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Name can only contain letters and spaces'),
  
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .toLowerCase(),
  
  body('phone')
    .optional()
    .custom(customValidators.isValidPhone)
    .withMessage('Please provide a valid phone number'),
  
  body('role')
    .optional()
    .isIn(['waiter', 'cook', 'chef', 'cashier', 'cleaner', 'manager', 'supervisor', 'host', 'bartender', 'delivery-boy', 'security'])
    .withMessage('Invalid role specified'),
  
  body('salary.base')
    .optional()
    .isNumeric()
    .withMessage('Base salary must be a number')
    .custom(customValidators.isValidSalary)
    .withMessage('Salary must be between ₹10,000 and ₹10,00,000'),
  
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean value'),
  
  body('terminationReason')
    .optional()
    .isLength({ min: 10, max: 500 })
    .withMessage('Termination reason must be between 10 and 500 characters'),
  
  handleValidationErrors
];

// Employee ID validation
const validateEmployeeId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid employee ID format'),
  
  handleValidationErrors
];

// Query parameters validation for employee listing
const validateEmployeeQuery = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be a positive integer between 1 and 1000'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('sortBy')
    .optional()
    .isIn(['name', 'email', 'employeeId', 'role', 'department', 'joinDate', 'salary.base', 'createdAt'])
    .withMessage('Invalid sort field'),
  
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be either asc or desc'),
  
  query('active')
    .optional()
    .isBoolean()
    .withMessage('Active filter must be true or false'),
  
  query('role')
    .optional()
    .custom((value) => {
      const validRoles = ['waiter', 'cook', 'chef', 'cashier', 'cleaner', 'manager', 'supervisor', 'host', 'bartender', 'delivery-boy', 'security'];
      if (Array.isArray(value)) {
        return value.every(role => validRoles.includes(role));
      }
      return validRoles.includes(value);
    })
    .withMessage('Invalid role filter'),
  
  query('department')
    .optional()
    .custom((value) => {
      const validDepartments = ['kitchen', 'service', 'management', 'maintenance', 'security', 'delivery'];
      if (Array.isArray(value)) {
        return value.every(dept => validDepartments.includes(dept));
      }
      return validDepartments.includes(value);
    })
    .withMessage('Invalid department filter'),
  
  query('salaryMin')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Minimum salary must be a positive number'),
  
  query('salaryMax')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Maximum salary must be a positive number'),
  
  query('ageMin')
    .optional()
    .isInt({ min: 18, max: 70 })
    .withMessage('Minimum age must be between 18 and 70'),
  
  query('ageMax')
    .optional()
    .isInt({ min: 18, max: 70 })
    .withMessage('Maximum age must be between 18 and 70'),
  
  query('joinDateFrom')
    .optional()
    .isISO8601()
    .withMessage('Invalid join date from format'),
  
  query('joinDateTo')
    .optional()
    .isISO8601()
    .withMessage('Invalid join date to format'),
  
  query('search')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Search term must be between 2 and 100 characters'),
  
  // Custom validation to ensure salary range is valid
  query('salaryMin').custom((value, { req }) => {
    if (value && req.query.salaryMax && parseInt(value) > parseInt(req.query.salaryMax)) {
      throw new Error('Minimum salary cannot be greater than maximum salary');
    }
    return true;
  }),
  
  // Custom validation to ensure age range is valid
  query('ageMin').custom((value, { req }) => {
    if (value && req.query.ageMax && parseInt(value) > parseInt(req.query.ageMax)) {
      throw new Error('Minimum age cannot be greater than maximum age');
    }
    return true;
  }),
  
  // Custom validation to ensure date range is valid
  query('joinDateFrom').custom((value, { req }) => {
    if (value && req.query.joinDateTo && new Date(value) > new Date(req.query.joinDateTo)) {
      throw new Error('Join date from cannot be later than join date to');
    }
    return true;
  }),
  
  handleValidationErrors
];

// Attendance query validation
const validateAttendanceQuery = [
  query('month')
    .optional()
    .isInt({ min: 1, max: 12 })
    .withMessage('Month must be between 1 and 12'),
  
  query('year')
    .optional()
    .isInt({ min: 2020, max: new Date().getFullYear() + 1 })
    .withMessage(`Year must be between 2020 and ${new Date().getFullYear() + 1}`),
  
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date format'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date format'),
  
  query('includeBreaks')
    .optional()
    .isBoolean()
    .withMessage('includeBreaks must be true or false'),
  
  query('groupBy')
    .optional()
    .isIn(['day', 'week', 'month'])
    .withMessage('groupBy must be day, week, or month'),
  
  // Custom validation to ensure date range is valid
  query('startDate').custom((value, { req }) => {
    if (value && req.query.endDate) {
      const startDate = new Date(value);
      const endDate = new Date(req.query.endDate);
      const daysDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);
      
      if (startDate >= endDate) {
        throw new Error('Start date must be before end date');
      }
      
      if (daysDiff > 365) {
        throw new Error('Date range cannot exceed 365 days');
      }
    }
    return true;
  }),
  
  handleValidationErrors
];

// Salary calculation parameters validation
const validateSalaryParams = [
  param('month')
    .isInt({ min: 1, max: 12 })
    .withMessage('Month must be between 1 and 12'),
  
  param('year')
    .isInt({ min: 2020, max: new Date().getFullYear() + 1 })
    .withMessage(`Year must be between 2020 and ${new Date().getFullYear() + 1}`),
  
  query('includeDeductions')
    .optional()
    .isBoolean()
    .withMessage('includeDeductions must be true or false'),
  
  query('includeAllowances')
    .optional()
    .isBoolean()
    .withMessage('includeAllowances must be true or false'),
  
  handleValidationErrors
];

// Leave application validation
const validateLeaveApplication = [
  body('leaveType')
    .isIn(['casual', 'sick', 'annual', 'emergency'])
    .withMessage('Invalid leave type'),
  
  body('startDate')
    .isISO8601()
    .withMessage('Invalid start date format')
    .custom((value) => {
      const startDate = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (startDate < today) {
        throw new Error('Start date cannot be in the past');
      }
      
      return true;
    }),
  
  body('endDate')
    .isISO8601()
    .withMessage('Invalid end date format'),
  
  body('reason')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Reason must be between 10 and 500 characters'),
  
  body('isEmergency')
    .optional()
    .isBoolean()
    .withMessage('isEmergency must be true or false'),
  
  // Custom validation to ensure date range is valid
  body('startDate').custom((value, { req }) => {
    if (value && req.body.endDate) {
      const startDate = new Date(value);
      const endDate = new Date(req.body.endDate);
      const daysDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);
      
      if (startDate > endDate) {
        throw new Error('Start date cannot be after end date');
      }
      
      if (daysDiff > 30) {
        throw new Error('Leave duration cannot exceed 30 days');
      }
    }
    return true;
  }),
  
  handleValidationErrors
];

// Performance review validation
const validatePerformanceReview = [
  body('ratings')
    .isObject()
    .withMessage('Ratings must be an object'),
  
  body('ratings.punctuality')
    .isInt({ min: 1, max: 5 })
    .withMessage('Punctuality rating must be between 1 and 5'),
  
  body('ratings.workQuality')
    .isInt({ min: 1, max: 5 })
    .withMessage('Work quality rating must be between 1 and 5'),
  
  body('ratings.teamwork')
    .isInt({ min: 1, max: 5 })
    .withMessage('Teamwork rating must be between 1 and 5'),
  
  body('ratings.customerService')
    .isInt({ min: 1, max: 5 })
    .withMessage('Customer service rating must be between 1 and 5'),
  
  body('ratings.hygiene')
    .isInt({ min: 1, max: 5 })
    .withMessage('Hygiene rating must be between 1 and 5'),
  
  body('ratings.initiative')
    .isInt({ min: 1, max: 5 })
    .withMessage('Initiative rating must be between 1 and 5'),
  
  body('strengths')
    .optional()
    .isArray()
    .withMessage('Strengths must be an array'),
  
  body('strengths.*')
    .optional()
    .isLength({ min: 5, max: 100 })
    .withMessage('Each strength must be between 5 and 100 characters'),
  
  body('improvements')
    .optional()
    .isArray()
    .withMessage('Improvements must be an array'),
  
  body('improvements.*')
    .optional()
    .isLength({ min: 5, max: 100 })
    .withMessage('Each improvement area must be between 5 and 100 characters'),
  
  body('goals')
    .optional()
    .isArray()
    .withMessage('Goals must be an array'),
  
  body('goals.*')
    .optional()
    .isLength({ min: 10, max: 200 })
    .withMessage('Each goal must be between 10 and 200 characters'),
  
  body('comments')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Comments cannot exceed 1000 characters'),
  
  body('nextReviewDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid next review date format')
    .custom((value) => {
      const reviewDate = new Date(value);
      const today = new Date();
      const threeMonthsFromNow = new Date();
      threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
      
      if (reviewDate <= today) {
        throw new Error('Next review date must be in the future');
      }
      
      if (reviewDate < threeMonthsFromNow) {
        throw new Error('Next review date should be at least 3 months from now');
      }
      
      return true;
    }),
  
  handleValidationErrors
];

// Bulk operation validation
const validateBulkOperation = [
  body('employeeIds')
    .isArray({ min: 1, max: 50 })
    .withMessage('Employee IDs must be an array with 1 to 50 items'),
  
  body('employeeIds.*')
    .isMongoId()
    .withMessage('Each employee ID must be a valid MongoDB ObjectId'),
  
  body('workLocation')
    .optional()
    .isIn(['kitchen', 'dining', 'counter', 'delivery', 'cleaning', 'store'])
    .withMessage('Invalid work location'),
  
  body('location')
    .optional()
    .isObject()
    .withMessage('Location must be an object'),
  
  body('location.latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  
  body('location.longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  
  body('location.address')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Address cannot exceed 200 characters'),
  
  handleValidationErrors
];

// Check-in/Check-out validation
const validateCheckInOut = [
  body('latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  
  body('longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  
  body('address')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Address cannot exceed 200 characters'),
  
  body('workLocation')
    .optional()
    .isIn(['kitchen', 'dining', 'counter', 'delivery', 'cleaning', 'store'])
    .withMessage('Invalid work location'),
  
  handleValidationErrors
];

// Break management validation
const validateBreak = [
  body('type')
    .isIn(['lunch', 'tea', 'dinner', 'other'])
    .withMessage('Invalid break type'),
  
  handleValidationErrors
];

// Report generation validation
const validateReportQuery = [
  query('startDate')
    .isISO8601()
    .withMessage('Invalid start date format'),
  
  query('endDate')
    .isISO8601()
    .withMessage('Invalid end date format'),
  
  query('department')
    .optional()
    .isIn(['kitchen', 'service', 'management', 'maintenance', 'security', 'delivery'])
    .withMessage('Invalid department'),
  
  query('role')
    .optional()
    .isIn(['waiter', 'cook', 'chef', 'cashier', 'cleaner', 'manager', 'supervisor', 'host', 'bartender', 'delivery-boy', 'security'])
    .withMessage('Invalid role'),
  
  query('reportType')
    .optional()
    .isIn(['summary', 'detailed'])
    .withMessage('Report type must be summary or detailed'),
  
  // Custom validation for date range
  query('startDate').custom((value, { req }) => {
    if (value && req.query.endDate) {
      const startDate = new Date(value);
      const endDate = new Date(req.query.endDate);
      const daysDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);
      
      if (startDate >= endDate) {
        throw new Error('Start date must be before end date');
      }
      
      if (daysDiff > 365) {
        throw new Error('Report date range cannot exceed 365 days');
      }
      
      // Don't allow future dates
      if (endDate > new Date()) {
        throw new Error('End date cannot be in the future');
      }
    }
    return true;
  }),
  
  handleValidationErrors
];

// Export format validation
const validateExportQuery = [
  param('format')
    .isIn(['json', 'csv', 'excel'])
    .withMessage('Export format must be json, csv, or excel'),
  
  query('month')
    .optional()
    .isInt({ min: 1, max: 12 })
    .withMessage('Month must be between 1 and 12'),
  
  query('year')
    .optional()
    .isInt({ min: 2020, max: new Date().getFullYear() })
    .withMessage(`Year must be between 2020 and ${new Date().getFullYear()}`),
  
  query('department')
    .optional()
    .isIn(['kitchen', 'service', 'management', 'maintenance', 'security', 'delivery'])
    .withMessage('Invalid department'),
  
  query('role')
    .optional()
    .isIn(['waiter', 'cook', 'chef', 'cashier', 'cleaner', 'manager', 'supervisor', 'host', 'bartender', 'delivery-boy', 'security'])
    .withMessage('Invalid role'),
  
  query('includeAttendance')
    .optional()
    .isBoolean()
    .withMessage('includeAttendance must be true or false'),
  
  query('includeSalary')
    .optional()
    .isBoolean()
    .withMessage('includeSalary must be true or false'),
  
  query('includePersonal')
    .optional()
    .isBoolean()
    .withMessage('includePersonal must be true or false'),
  
  handleValidationErrors
];

// Advanced search validation
const validateAdvancedSearch = [
  body('searchTerm')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Search term must be between 2 and 100 characters'),
  
  body('filters')
    .optional()
    .isObject()
    .withMessage('Filters must be an object'),
  
  body('sortBy')
    .optional()
    .isIn(['name', 'email', 'employeeId', 'role', 'department', 'joinDate', 'salary.base', 'experience.total'])
    .withMessage('Invalid sort field'),
  
  body('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
  
  body('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be between 1 and 1000'),
  
  body('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  body('suggestions')
    .optional()
    .isBoolean()
    .withMessage('Suggestions must be true or false'),
  
  // Validate nested filter objects
  body('filters.role')
    .optional()
    .isArray()
    .withMessage('Role filter must be an array'),
  
  body('filters.role.*')
    .optional()
    .isIn(['waiter', 'cook', 'chef', 'cashier', 'cleaner', 'manager', 'supervisor', 'host', 'bartender', 'delivery-boy', 'security'])
    .withMessage('Invalid role in filter'),
  
  body('filters.department')
    .optional()
    .isArray()
    .withMessage('Department filter must be an array'),
  
  body('filters.department.*')
    .optional()
    .isIn(['kitchen', 'service', 'management', 'maintenance', 'security', 'delivery'])
    .withMessage('Invalid department in filter'),
  
  body('filters.salaryRange')
    .optional()
    .isObject()
    .withMessage('Salary range must be an object'),
  
  body('filters.salaryRange.min')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Minimum salary must be a positive number'),
  
  body('filters.salaryRange.max')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Maximum salary must be a positive number'),
  
  body('filters.experienceRange')
    .optional()
    .isObject()
    .withMessage('Experience range must be an object'),
  
  body('filters.experienceRange.min')
    .optional()
    .isInt({ min: 0, max: 50 })
    .withMessage('Minimum experience must be between 0 and 50 years'),
  
  body('filters.experienceRange.max')
    .optional()
    .isInt({ min: 0, max: 50 })
    .withMessage('Maximum experience must be between 0 and 50 years'),
  
  body('filters.skills')
    .optional()
    .isArray()
    .withMessage('Skills filter must be an array'),
  
  body('filters.skills.*')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Each skill must be between 2 and 50 characters'),
  
  body('filters.contractType')
    .optional()
    .isIn(['permanent', 'temporary', 'contract', 'part-time'])
    .withMessage('Invalid contract type in filter'),
  
  body('filters.joinDateRange')
    .optional()
    .isObject()
    .withMessage('Join date range must be an object'),
  
  body('filters.joinDateRange.from')
    .optional()
    .isISO8601()
    .withMessage('Invalid from date format'),
  
  body('filters.joinDateRange.to')
    .optional()
    .isISO8601()
    .withMessage('Invalid to date format'),
  
  // Custom validations for ranges
  body('filters.salaryRange').custom((value) => {
    if (value && value.min && value.max && value.min > value.max) {
      throw new Error('Minimum salary cannot be greater than maximum salary');
    }
    return true;
  }),
  
  body('filters.experienceRange').custom((value) => {
    if (value && value.min && value.max && value.min > value.max) {
      throw new Error('Minimum experience cannot be greater than maximum experience');
    }
    return true;
  }),
  
  body('filters.joinDateRange').custom((value) => {
    if (value && value.from && value.to && new Date(value.from) > new Date(value.to)) {
      throw new Error('From date cannot be later than to date');
    }
    return true;
  }),
  
  handleValidationErrors
];

// Shift timing validation
const validateShiftTiming = [
  body('shiftTiming')
    .isObject()
    .withMessage('Shift timing must be an object'),
  
  body('shiftTiming.startTime')
    .custom(customValidators.isValidTime)
    .withMessage('Please provide valid start time in HH:MM format'),
  
  body('shiftTiming.endTime')
    .custom(customValidators.isValidTime)
    .withMessage('Please provide valid end time in HH:MM format'),
  
  body('shiftTiming.type')
    .optional()
    .isIn(['fixed', 'flexible', 'rotating'])
    .withMessage('Shift type must be fixed, flexible, or rotating'),
  
  body('shiftTiming.breakDuration')
    .optional()
    .isInt({ min: 0, max: 480 })
    .withMessage('Break duration must be between 0 and 480 minutes'),
  
  body('shiftTiming.weeklyOffs')
    .optional()
    .isArray()
    .withMessage('Weekly offs must be an array'),
  
  body('shiftTiming.weeklyOffs.*')
    .optional()
    .isIn(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
    .withMessage('Invalid day in weekly offs'),
  
  // Custom validation to ensure end time is after start time
  body('shiftTiming').custom((value) => {
    if (value.startTime && value.endTime) {
      const [startHour, startMinute] = value.startTime.split(':').map(Number);
      const [endHour, endMinute] = value.endTime.split(':').map(Number);
      
      const startTotalMinutes = startHour * 60 + startMinute;
      const endTotalMinutes = endHour * 60 + endMinute;
      
      // Handle overnight shifts
      if (endTotalMinutes <= startTotalMinutes && endTotalMinutes < 360) { // Before 6 AM
        return true; // Overnight shift
      }
      
      if (endTotalMinutes <= startTotalMinutes) {
        throw new Error('End time must be after start time for same-day shifts');
      }
      
      // Check minimum shift duration (at least 4 hours)
      const shiftDuration = endTotalMinutes - startTotalMinutes;
      if (shiftDuration < 240) { // 4 hours = 240 minutes
        throw new Error('Shift duration must be at least 4 hours');
      }
      
      // Check maximum shift duration (at most 12 hours)
      if (shiftDuration > 720) { // 12 hours = 720 minutes
        throw new Error('Shift duration cannot exceed 12 hours');
      }
    }
    return true;
  }),
  
  handleValidationErrors
];

module.exports = {
  validateEmployee,
  validateEmployeeUpdate,
  validateEmployeeId,
  validateEmployeeQuery,
  validateAttendanceQuery,
  validateSalaryParams,
  validateLeaveApplication,
  validatePerformanceReview,
  validateBulkOperation,
  validateCheckInOut,
  validateBreak,
  validateReportQuery,
  validateExportQuery,
  validateAdvancedSearch,
  validateShiftTiming,
  customValidators,
  handleValidationErrors
};