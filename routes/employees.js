const express = require('express');
const Employee = require('../models/Employee');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const { upload, deleteFromCloudinary, cloudinary } = require('../config/cloudinary');

const router = express.Router();

// Helper function for standardized responses
const sendResponse = (res, statusCode, success, message, data = null, meta = null) => {
  const response = {
    success,
    message,
    data,
    timestamp: new Date().toISOString()
  };
  
  if (meta) response.meta = meta;
  res.status(statusCode).json(response);
};

// Enhanced error handling
const handleError = (res, error, message = 'Server error', context = {}) => {
  console.error('Employee Route Error:', {
    error: error.message,
    stack: error.stack,
    context
  });
  
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map(err => ({
      field: err.path,
      message: err.message,
      value: err.value
    }));
    return sendResponse(res, 400, false, 'Validation failed', { errors });
  }
  
  if (error.name === 'CastError') {
    return sendResponse(res, 400, false, 'Invalid ID format');
  }
  
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern)[0];
    const value = error.keyValue[field];
    return sendResponse(res, 400, false, `${field} '${value}' already exists`);
  }
  
  sendResponse(res, 500, false, message);
};

// ==================== EMPLOYEE CRUD OPERATIONS ====================

// Get all employees with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search = '',
      role = '',
      department = '',
      isActive = 'true'
    } = req.query;

    // Build query
    let query = {};
    if (isActive !== 'all') query.isActive = isActive === 'true';
    if (role) query.role = role;
    if (department) query.department = department;
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query with pagination
    const employees = await Employee.find(query)
      .select('-password')
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();

    const total = await Employee.countDocuments(query);

    // Get statistics
    const [roleStats, departmentStats] = await Promise.all([
      Employee.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ]),
      Employee.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$department', count: { $sum: 1 } } }
      ])
    ]);

    const stats = {
      roles: roleStats.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
      departments: departmentStats.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {})
    };

    const pagination = {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      totalRecords: total,
      limit: parseInt(limit),
      hasNext: page * limit < total,
      hasPrev: page > 1
    };

    sendResponse(res, 200, true, 'Employees retrieved successfully', {
      employees,
      stats
    }, { pagination });

  } catch (error) {
    handleError(res, error, 'Failed to retrieve employees');
  }
});

// Get single employee
router.get('/:id', async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id)
      .select('-password')
      .populate('createdBy updatedBy', 'name employeeId');
    
    if (!employee) {
      return sendResponse(res, 404, false, 'Employee not found');
    }

    // Get current month attendance
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const monthlyStats = employee.getMonthlyAttendance(currentMonth, currentYear);

    // Get recent attendance (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentAttendance = employee.attendance
      .filter(att => att.date >= thirtyDaysAgo)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 30);

    const employeeData = employee.toObject();
    employeeData.recentAttendance = recentAttendance;
    employeeData.currentMonthStats = monthlyStats;
    employeeData.currentLeaveBalance = employee.currentLeaveBalance;

    sendResponse(res, 200, true, 'Employee retrieved successfully', employeeData);
  } catch (error) {
    handleError(res, error, 'Failed to retrieve employee');
  }
});

// Create new employee
router.post('/', upload.single('profilePicture'), async (req, res) => {
  try {
    const employeeData = { ...req.body };

    // Handle profile picture upload
    if (req.file) {
      employeeData.profilePicture = req.file.path;
    }

    // Parse nested objects if they come as strings
    const objectFields = ['salary', 'address', 'emergencyContact', 'shiftTiming', 'bankDetails'];
    objectFields.forEach(field => {
      if (typeof employeeData[field] === 'string') {
        try {
          employeeData[field] = JSON.parse(employeeData[field]);
        } catch (e) {
          console.log(`Failed to parse ${field}:`, e.message);
        }
      }
    });

    // Parse arrays
    if (typeof employeeData.skills === 'string') {
      employeeData.skills = employeeData.skills.split(',').map(s => s.trim());
    }

    const employee = new Employee(employeeData);
    await employee.save();

    const employeeResponse = employee.toObject();
    delete employeeResponse.password;

    sendResponse(res, 201, true, 'Employee created successfully', employeeResponse);
  } catch (error) {
    handleError(res, error, 'Failed to create employee');
  }
});

// Update employee
router.put('/:id', upload.single('profilePicture'), async (req, res) => {
  try {
    const updateData = { ...req.body };
    
    // Remove fields that shouldn't be updated directly
    delete updateData._id;
    delete updateData.employeeId;
    delete updateData.attendance;
    delete updateData.createdAt;
    delete updateData.createdBy;

    // Handle profile picture upload
    if (req.file) {
      updateData.profilePicture = req.file.path;
    }

    // Parse nested objects
    const objectFields = ['salary', 'address', 'emergencyContact', 'shiftTiming', 'bankDetails'];
    objectFields.forEach(field => {
      if (typeof updateData[field] === 'string') {
        try {
          updateData[field] = JSON.parse(updateData[field]);
        } catch (e) {
          console.log(`Failed to parse ${field}:`, e.message);
        }
      }
    });

    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!employee) {
      return sendResponse(res, 404, false, 'Employee not found');
    }

    sendResponse(res, 200, true, 'Employee updated successfully', employee);
  } catch (error) {
    handleError(res, error, 'Failed to update employee');
  }
});

// Soft delete employee
router.delete('/:id', async (req, res) => {
  try {
    const { reason = 'Administrative action' } = req.body;
    
    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      { 
        isActive: false,
        terminationDate: new Date(),
        terminationReason: reason
      },
      { new: true }
    ).select('employeeId name email');
    
    if (!employee) {
      return sendResponse(res, 404, false, 'Employee not found');
    }

    sendResponse(res, 200, true, 'Employee deactivated successfully', {
      employeeId: employee.employeeId,
      name: employee.name,
      email: employee.email,
      terminationReason: reason
    });
  } catch (error) {
    handleError(res, error, 'Failed to deactivate employee');
  }
});

// ==================== ATTENDANCE MANAGEMENT ====================

// Check-in
router.post('/:id/checkin', async (req, res) => {
  try {
    const { latitude, longitude, address, workLocation = 'dining' } = req.body;
    
    const employee = await Employee.findById(req.params.id);
    
    if (!employee) {
      return sendResponse(res, 404, false, 'Employee not found');
    }

    if (!employee.isActive) {
      return sendResponse(res, 400, false, 'Cannot check in inactive employee');
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Check if already checked in today
    const existingAttendance = employee.attendance.find(
      att => att.date.toDateString() === today.toDateString()
    );

    if (existingAttendance && existingAttendance.loginTime) {
      return sendResponse(res, 400, false, 'Already checked in today', {
        loginTime: existingAttendance.loginTime,
        workLocation: existingAttendance.workLocation
      });
    }

    // Calculate late status
    const shiftStart = employee.shiftTiming.startTime || '09:00';
    const [startHour, startMinute] = shiftStart.split(':').map(Number);
    const shiftStartTime = new Date(today);
    shiftStartTime.setHours(startHour, startMinute, 0, 0);
    
    const lateMinutes = Math.max(0, Math.floor((now - shiftStartTime) / (1000 * 60)));
    const status = lateMinutes > 15 ? 'late' : 'present';

    const attendanceData = {
      date: today,
      loginTime: now,
      isPresent: true,
      status: status,
      lateMinutes: lateMinutes,
      workLocation: workLocation,
      checkInLocation: latitude && longitude ? {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address: address || ''
      } : undefined,
      breaks: [],
      totalBreakTime: 0
    };

    if (existingAttendance) {
      Object.assign(existingAttendance, attendanceData);
    } else {
      employee.attendance.push(attendanceData);
    }

    employee.lastLogin = now;
    await employee.save();

    sendResponse(res, 200, true, 'Check-in successful', {
      loginTime: now,
      status: status,
      lateMinutes: lateMinutes,
      workLocation: workLocation,
      message: lateMinutes > 15 ? `Late by ${lateMinutes} minutes` : 'On time check-in'
    });
  } catch (error) {
    handleError(res, error, 'Check-in failed');
  }
});

// Check-out
router.post('/:id/checkout', async (req, res) => {
  try {
    const { latitude, longitude, address } = req.body;
    
    const employee = await Employee.findById(req.params.id);
    
    if (!employee) {
      return sendResponse(res, 404, false, 'Employee not found');
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const todayAttendance = employee.attendance.find(
      att => att.date.toDateString() === today.toDateString()
    );

    if (!todayAttendance || !todayAttendance.loginTime) {
      return sendResponse(res, 400, false, 'Not checked in today');
    }

    if (todayAttendance.logoutTime) {
      return sendResponse(res, 400, false, 'Already checked out today', {
        logoutTime: todayAttendance.logoutTime,
        hoursWorked: todayAttendance.hoursWorked
      });
    }

    // End any ongoing break
    const ongoingBreak = todayAttendance.breaks.find(b => !b.endTime);
    if (ongoingBreak) {
      ongoingBreak.endTime = now;
      ongoingBreak.duration = Math.round((now - ongoingBreak.startTime) / (1000 * 60));
      
      // Update total break time
      todayAttendance.totalBreakTime = todayAttendance.breaks.reduce(
        (total, breakItem) => total + (breakItem.duration || 0), 0
      );
    }

    // Calculate total hours worked
    const totalMinutesWorked = (now - todayAttendance.loginTime) / (1000 * 60);
    const totalBreakTime = todayAttendance.totalBreakTime || 0;
    const actualMinutesWorked = totalMinutesWorked - totalBreakTime;
    const hoursWorked = actualMinutesWorked / 60;

    // Calculate shift hours and overtime
    const shiftStart = employee.shiftTiming.startTime || '09:00';
    const shiftEnd = employee.shiftTiming.endTime || '18:00';
    const [startHour, startMinute] = shiftStart.split(':').map(Number);
    const [endHour, endMinute] = shiftEnd.split(':').map(Number);
    
    const shiftEndTime = new Date(today);
    shiftEndTime.setHours(endHour, endMinute, 0, 0);
    
    const standardShiftHours = ((endHour * 60 + endMinute) - (startHour * 60 + startMinute)) / 60;
    const overtimeHours = Math.max(0, hoursWorked - standardShiftHours);
    const earlyLeaveMinutes = Math.max(0, Math.floor((shiftEndTime - now) / (1000 * 60)));

    // Update attendance record
    todayAttendance.logoutTime = now;
    todayAttendance.hoursWorked = Math.round(hoursWorked * 100) / 100;
    todayAttendance.overtimeHours = Math.round(overtimeHours * 100) / 100;
    
    if (latitude && longitude) {
      todayAttendance.checkOutLocation = {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address: address || ''
      };
    }

    // Determine final status
    if (overtimeHours > 0.5) {
      todayAttendance.status = 'overtime';
    } else if (earlyLeaveMinutes > 30) {
      todayAttendance.status = 'early-leave';
      todayAttendance.earlyLeaveMinutes = earlyLeaveMinutes;
    } else if (hoursWorked < 4) {
      todayAttendance.status = 'half-day';
    }

    await employee.save();

    const responseData = {
      logoutTime: now,
      hoursWorked: todayAttendance.hoursWorked,
      overtimeHours: todayAttendance.overtimeHours,
      status: todayAttendance.status,
      totalBreakTime: Math.round(totalBreakTime / 60 * 100) / 100,
      earlyLeaveMinutes: todayAttendance.earlyLeaveMinutes || 0
    };

    let message = 'Check-out successful';
    if (overtimeHours > 0.5) {
      message += ` with ${Math.round(overtimeHours * 100) / 100} hours overtime`;
    } else if (earlyLeaveMinutes > 30) {
      message += ` (Early leave by ${earlyLeaveMinutes} minutes)`;
    }

    sendResponse(res, 200, true, message, responseData);
  } catch (error) {
    handleError(res, error, 'Check-out failed');
  }
});

// Start break
router.post('/:id/break/start', async (req, res) => {
  try {
    const { type = 'other' } = req.body;
    const validBreakTypes = ['lunch', 'tea', 'dinner', 'other'];
    
    if (!validBreakTypes.includes(type)) {
      return sendResponse(res, 400, false, 'Invalid break type');
    }
    
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return sendResponse(res, 404, false, 'Employee not found');
    }

    const today = new Date();
    const todayString = today.toDateString();
    
    const todayAttendance = employee.attendance.find(
      att => att.date.toDateString() === todayString
    );

    if (!todayAttendance || !todayAttendance.loginTime) {
      return sendResponse(res, 400, false, 'Employee not checked in today');
    }

    if (todayAttendance.logoutTime) {
      return sendResponse(res, 400, false, 'Employee already checked out');
    }

    // Check if there's an ongoing break
    const ongoingBreak = todayAttendance.breaks.find(b => !b.endTime);
    if (ongoingBreak) {
      return sendResponse(res, 400, false, 'Break already in progress', {
        breakType: ongoingBreak.type,
        startTime: ongoingBreak.startTime
      });
    }

    // Add new break
    todayAttendance.breaks.push({
      startTime: today,
      type: type
    });

    await employee.save();

    sendResponse(res, 200, true, `${type.charAt(0).toUpperCase() + type.slice(1)} break started`, {
      breakType: type,
      startTime: today
    });
  } catch (error) {
    handleError(res, error, 'Failed to start break');
  }
});

// End break
router.post('/:id/break/end', async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return sendResponse(res, 404, false, 'Employee not found');
    }

    const today = new Date();
    const todayString = today.toDateString();
    
    const todayAttendance = employee.attendance.find(
      att => att.date.toDateString() === todayString
    );

    if (!todayAttendance) {
      return sendResponse(res, 400, false, 'No attendance record found for today');
    }

    // Find ongoing break
    const ongoingBreak = todayAttendance.breaks.find(b => !b.endTime);
    if (!ongoingBreak) {
      return sendResponse(res, 400, false, 'No ongoing break found');
    }

    // End the break
    ongoingBreak.endTime = today;
    ongoingBreak.duration = Math.round((today - ongoingBreak.startTime) / (1000 * 60));

    // Update total break time
    todayAttendance.totalBreakTime = todayAttendance.breaks.reduce(
      (total, breakItem) => total + (breakItem.duration || 0), 0
    );

    await employee.save();

    sendResponse(res, 200, true, `${ongoingBreak.type.charAt(0).toUpperCase() + ongoingBreak.type.slice(1)} break ended`, {
      breakType: ongoingBreak.type,
      duration: ongoingBreak.duration,
      totalBreakTime: todayAttendance.totalBreakTime
    });
  } catch (error) {
    handleError(res, error, 'Failed to end break');
  }
});

// Get today's attendance summary
router.get('/attendance/today', async (req, res) => {
  try {
    const { department, role } = req.query;
    
    let matchQuery = { isActive: true };
    if (department) matchQuery.department = department;
    if (role) matchQuery.role = role;

    const today = new Date();
    const todayString = today.toDateString();

    const employees = await Employee.find(matchQuery)
      .select('name employeeId role department attendance shiftTiming')
      .lean();

    const attendanceSummary = employees.map(emp => {
      const todayAttendance = emp.attendance.find(
        att => new Date(att.date).toDateString() === todayString
      );

      // Check if on break
      const onBreak = todayAttendance?.breaks?.some(b => !b.endTime) || false;

      return {
        id: emp._id,
        name: emp.name,
        employeeId: emp.employeeId,
        role: emp.role,
        department: emp.department,
        isPresent: todayAttendance?.isPresent || false,
        loginTime: todayAttendance?.loginTime,
        logoutTime: todayAttendance?.logoutTime,
        hoursWorked: todayAttendance?.hoursWorked || 0,
        overtimeHours: todayAttendance?.overtimeHours || 0,
        status: todayAttendance?.status || 'absent',
        lateMinutes: todayAttendance?.lateMinutes || 0,
        onBreak: onBreak,
        totalBreakTime: todayAttendance?.totalBreakTime || 0,
        shiftStart: emp.shiftTiming?.startTime || '09:00',
        shiftEnd: emp.shiftTiming?.endTime || '18:00'
      };
    });

    const presentCount = attendanceSummary.filter(emp => emp.isPresent).length;
    const lateCount = attendanceSummary.filter(emp => emp.status === 'late').length;
    const overtimeCount = attendanceSummary.filter(emp => emp.overtimeHours > 0).length;
    const onBreakCount = attendanceSummary.filter(emp => emp.onBreak).length;
    const totalEmployees = employees.length;

    // Department-wise summary
    const departmentSummary = attendanceSummary.reduce((acc, emp) => {
      if (!acc[emp.department]) {
        acc[emp.department] = { total: 0, present: 0, absent: 0 };
      }
      acc[emp.department].total++;
      if (emp.isPresent) {
        acc[emp.department].present++;
      } else {
        acc[emp.department].absent++;
      }
      return acc;
    }, {});

    sendResponse(res, 200, true, 'Today\'s attendance retrieved successfully', {
      date: todayString,
      attendanceSummary,
      summary: {
        present: presentCount,
        absent: totalEmployees - presentCount,
        late: lateCount,
        overtime: overtimeCount,
        onBreak: onBreakCount,
        total: totalEmployees,
        attendancePercentage: totalEmployees > 0 ? Math.round((presentCount / totalEmployees) * 100) : 0
      },
      departmentSummary
    });
  } catch (error) {
    handleError(res, error, 'Failed to retrieve today\'s attendance');
  }
});

// Get attendance report for specific employee
router.get('/:id/attendance', async (req, res) => {
  try {
    const { month, year, startDate, endDate } = req.query;
    
    const employee = await Employee.findById(req.params.id);
    
    if (!employee) {
      return sendResponse(res, 404, false, 'Employee not found');
    }

    let attendanceData;
    let period;

    if (startDate && endDate) {
      // Custom date range
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      const attendanceInRange = employee.attendance.filter(att => 
        att.date >= start && att.date <= end
      );

      const presentDays = attendanceInRange.filter(att => att.isPresent).length;
      const totalHours = attendanceInRange.reduce((sum, att) => sum + (att.hoursWorked || 0), 0);
      const overtimeHours = attendanceInRange.reduce((sum, att) => sum + (att.overtimeHours || 0), 0);
      const totalBreakTime = attendanceInRange.reduce((sum, att) => sum + (att.totalBreakTime || 0), 0);
      const lateCount = attendanceInRange.filter(att => att.status === 'late').length;

      attendanceData = {
        attendance: attendanceInRange,
        presentDays,
        totalHours: Math.round(totalHours * 100) / 100,
        overtimeHours: Math.round(overtimeHours * 100) / 100,
        totalBreakTime: Math.round(totalBreakTime / 60 * 100) / 100, // Convert to hours
        lateCount,
        averageHours: presentDays > 0 ? Math.round((totalHours / presentDays) * 100) / 100 : 0
      };
      
      period = `${startDate} to ${endDate}`;
    } else {
      // Monthly report
      const currentMonth = month || (new Date().getMonth() + 1);
      const currentYear = year || new Date().getFullYear();
      attendanceData = employee.getMonthlyAttendance(currentMonth, currentYear);
      period = `${currentMonth}/${currentYear}`;
    }

    sendResponse(res, 200, true, 'Attendance retrieved successfully', {
      employee: {
        id: employee._id,
        name: employee.name,
        employeeId: employee.employeeId,
        role: employee.role,
        department: employee.department
      },
      period,
      ...attendanceData
    });
  } catch (error) {
    handleError(res, error, 'Failed to retrieve attendance');
  }
});

// ==================== SALARY MANAGEMENT ====================

// Calculate salary for specific month
router.get('/:id/salary/:month/:year', async (req, res) => {
  try {
    const { month, year } = req.params;
    
    const employee = await Employee.findById(req.params.id);
    
    if (!employee) {
      return sendResponse(res, 404, false, 'Employee not found');
    }

    const monthlyAttendance = employee.getMonthlyAttendance(month, year);
    const salaryData = employee.calculateSalary(month, year);

    // Calculate additional allowances and deductions
    const allowances = {
      transport: 1000,
      meal: 500,
      mobile: 300,
      performance: monthlyAttendance.attendancePercentage >= 95 ? 2000 : 0
    };

    const deductions = {
      pf: Math.round((salaryData.baseSalary || salaryData.basePay) * 0.12), // 12% PF
      esi: Math.round((salaryData.baseSalary || salaryData.basePay) * 0.0175),
      tax: 0,
      advance: employee.salary.deductions || 0
    };

    const totalAllowances = Object.values(allowances).reduce((sum, val) => sum + val, 0);
    const totalDeductions = Object.values(deductions).reduce((sum, val) => sum + val, 0);

    const payslip = {
      employee: {
        name: employee.name,
        employeeId: employee.employeeId,
        role: employee.role,
        department: employee.department,
        joinDate: employee.joinDate,
        bankDetails: employee.bankDetails
      },
      period: {
        month: parseInt(month),
        year: parseInt(year),
        monthName: new Date(year, month - 1).toLocaleString('default', { month: 'long' }),
        workingDays: monthlyAttendance.presentDays + monthlyAttendance.absentDays,
        presentDays: monthlyAttendance.presentDays
      },
      earnings: {
        basicSalary: salaryData.baseSalary || salaryData.basePay || 0,
        overtimePay: salaryData.overtimePay || 0,
        allowances,
        totalAllowances,
        grossEarnings: (salaryData.grossSalary || 0) + totalAllowances
      },
      deductions: {
        ...deductions,
        totalDeductions,
      },
      netSalary: (salaryData.grossSalary || 0) + totalAllowances - totalDeductions,
      attendance: {
        totalWorkingDays: monthlyAttendance.presentDays + monthlyAttendance.absentDays,
        presentDays: monthlyAttendance.presentDays,
        absentDays: monthlyAttendance.absentDays,
        totalHours: monthlyAttendance.totalHours,
        overtimeHours: monthlyAttendance.overtimeHours || 0,
        attendancePercentage: monthlyAttendance.attendancePercentage
      },
      generatedOn: new Date()
    };

    sendResponse(res, 200, true, 'Payslip generated successfully', payslip);
  } catch (error) {
    handleError(res, error, 'Failed to generate payslip');
  }
});

// Get salary summary for all employees
router.get('/salary/summary/:month/:year', async (req, res) => {
  try {
    const { month, year } = req.params;
    const { department, role } = req.query;

    let query = { isActive: true };
    if (department) query.department = department;
    if (role) query.role = role;

    const employees = await Employee.find(query);
    
    const salarySummary = [];
    let totalPayroll = 0;
    let totalHours = 0;
    let totalOvertimeHours = 0;

    for (const employee of employees) {
      const monthlyAttendance = employee.getMonthlyAttendance(month, year);
      const salaryData = employee.calculateSalary(month, year);
      
      const allowances = {
        transport: 1000,
        meal: 500,
        mobile: 300,
        performance: monthlyAttendance.attendancePercentage >= 95 ? 2000 : 0
      };

      const deductions = {
        pf: Math.round((salaryData.baseSalary || salaryData.basePay) * 0.12),
        esi: Math.round((salaryData.baseSalary || salaryData.basePay) * 0.0175),
        tax: 0,
        advance: employee.salary.deductions || 0
      };

      const totalAllowances = Object.values(allowances).reduce((sum, val) => sum + val, 0);
      const totalDeductions = Object.values(deductions).reduce((sum, val) => sum + val, 0);
      const netSalary = (salaryData.grossSalary || 0) + totalAllowances - totalDeductions;

      salarySummary.push({
        employee: {
          id: employee._id,
          name: employee.name,
          employeeId: employee.employeeId,
          role: employee.role,
          department: employee.department
        },
        attendance: {
          presentDays: monthlyAttendance.presentDays,
          totalHours: monthlyAttendance.totalHours,
          overtimeHours: monthlyAttendance.overtimeHours || 0,
          attendancePercentage: monthlyAttendance.attendancePercentage
        },
        salary: {
          basicSalary: salaryData.baseSalary || salaryData.basePay || 0,
          grossSalary: salaryData.grossSalary || 0,
          totalAllowances,
          totalDeductions,
          netSalary
        }
      });

      totalPayroll += netSalary;
      totalHours += monthlyAttendance.totalHours;
      totalOvertimeHours += monthlyAttendance.overtimeHours || 0;
    }

    const summary = {
      period: `${month}/${year}`,
      totalEmployees: employees.length,
      totalPayroll: Math.round(totalPayroll),
      averageSalary: Math.round(totalPayroll / employees.length),
      totalHours: Math.round(totalHours),
      totalOvertimeHours: Math.round(totalOvertimeHours),
      departmentBreakdown: {},
      roleBreakdown: {}
    };

    // Calculate department breakdown
    const deptGroups = salarySummary.reduce((acc, emp) => {
      if (!acc[emp.employee.department]) {
        acc[emp.employee.department] = { count: 0, totalSalary: 0 };
      }
      acc[emp.employee.department].count++;
      acc[emp.employee.department].totalSalary += emp.salary.netSalary;
      return acc;
    }, {});

    Object.keys(deptGroups).forEach(dept => {
      summary.departmentBreakdown[dept] = {
        employees: deptGroups[dept].count,
        totalSalary: Math.round(deptGroups[dept].totalSalary),
        averageSalary: Math.round(deptGroups[dept].totalSalary / deptGroups[dept].count)
      };
    });

    sendResponse(res, 200, true, 'Salary summary retrieved successfully', {
      summary,
      employees: salarySummary
    });
  } catch (error) {
    handleError(res, error, 'Failed to retrieve salary summary');
  }
});

// ==================== REPORTS AND ANALYTICS ====================

// Attendance statistics
router.get('/stats/attendance', async (req, res) => {
  try {
    const { month, year, department, role } = req.query;
    
    const currentMonth = month || (new Date().getMonth() + 1);
    const currentYear = year || new Date().getFullYear();

    let query = { isActive: true };
    if (department) query.department = department;
    if (role) query.role = role;

    const employees = await Employee.find(query);
    
    const analytics = {
      period: `${currentMonth}/${currentYear}`,
      totalEmployees: employees.length,
      overallStats: {
        totalPresent: 0,
        totalHours: 0,
        totalOvertimeHours: 0,
        averageAttendance: 0,
        punctualityScore: 0
      },
      departmentStats: {},
      roleStats: {},
      performanceMetrics: {
        topPerformers: [],
        concernedEmployees: []
      }
    };

    let totalPresentDays = 0;
    let totalPossibleDays = 0;
    let totalLateCount = 0;
    let totalEarlyLeaveCount = 0;

    const employeeMetrics = [];

    employees.forEach(emp => {
      const monthlyData = emp.getMonthlyAttendance(currentMonth, currentYear);
      
      totalPresentDays += monthlyData.presentDays;
      totalPossibleDays += (monthlyData.presentDays + monthlyData.absentDays);
      totalLateCount += monthlyData.lateCount || 0;
      totalEarlyLeaveCount += monthlyData.earlyLeaveCount || 0;
      
      analytics.overallStats.totalHours += monthlyData.totalHours;
      analytics.overallStats.totalOvertimeHours += monthlyData.overtimeHours || 0;

      // Department stats
      if (!analytics.departmentStats[emp.department]) {
        analytics.departmentStats[emp.department] = {
          employees: 0,
          totalPresent: 0,
          totalHours: 0,
          averageAttendance: 0
        };
      }
      
      const deptStats = analytics.departmentStats[emp.department];
      deptStats.employees++;
      deptStats.totalPresent += monthlyData.presentDays;
      deptStats.totalHours += monthlyData.totalHours;

      // Role stats
      if (!analytics.roleStats[emp.role]) {
        analytics.roleStats[emp.role] = {
          employees: 0,
          totalPresent: 0,
          averageAttendance: 0
        };
      }
      
      const roleStats = analytics.roleStats[emp.role];
      roleStats.employees++;
      roleStats.totalPresent += monthlyData.presentDays;

      // Employee metrics for performance analysis
      employeeMetrics.push({
        id: emp._id,
        name: emp.name,
        employeeId: emp.employeeId,
        department: emp.department,
        role: emp.role,
        attendancePercentage: monthlyData.attendancePercentage,
        punctualityScore: monthlyData.punctualityScore,
        totalHours: monthlyData.totalHours,
        overtimeHours: monthlyData.overtimeHours || 0
      });
    });

    // Calculate overall averages
    analytics.overallStats.averageAttendance = totalPossibleDays > 0 ? 
      Math.round((totalPresentDays / totalPossibleDays) * 100) : 0;
    
    analytics.overallStats.punctualityScore = totalPresentDays > 0 ?
      Math.round(((totalPresentDays - totalLateCount - totalEarlyLeaveCount) / totalPresentDays) * 100) : 0;

    // Calculate department averages
    Object.keys(analytics.departmentStats).forEach(dept => {
      const stats = analytics.departmentStats[dept];
      const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
      stats.averageAttendance = Math.round((stats.totalPresent / (stats.employees * daysInMonth)) * 100);
    });

    // Performance metrics
    const sortedByAttendance = [...employeeMetrics].sort((a, b) => b.attendancePercentage - a.attendancePercentage);

    analytics.performanceMetrics.topPerformers = sortedByAttendance.slice(0, 5).map(emp => ({
      ...emp,
      performanceScore: Math.round((emp.attendancePercentage * 0.7 + emp.punctualityScore * 0.3) * 100) / 100
    }));

    analytics.performanceMetrics.concernedEmployees = sortedByAttendance
      .filter(emp => emp.attendancePercentage < 80 || emp.punctualityScore < 70)
      .slice(0, 10);

    sendResponse(res, 200, true, 'Attendance statistics retrieved successfully', analytics);
  } catch (error) {
    handleError(res, error, 'Failed to retrieve attendance statistics');
  }
});

// Comprehensive report
router.get('/reports/comprehensive', async (req, res) => {
  try {
    const { startDate, endDate, department, role, reportType = 'summary' } = req.query;
    
    if (!startDate || !endDate) {
      return sendResponse(res, 400, false, 'Start date and end date are required');
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start >= end) {
      return sendResponse(res, 400, false, 'End date must be after start date');
    }
    
    let query = { isActive: true };
    if (department) query.department = department;
    if (role) query.role = role;
    
    const employees = await Employee.find(query);
    
    const report = {
      period: `${startDate} to ${endDate}`,
      generatedAt: new Date().toISOString(),
      filters: { department, role },
      summary: {
        totalEmployees: employees.length,
        totalWorkingDays: Math.ceil((end - start) / (1000 * 60 * 60 * 24)),
        totalPresent: 0,
        totalAbsent: 0,
        totalHours: 0,
        totalOvertimeHours: 0,
        totalSalaryPaid: 0
      },
      departmentBreakdown: {},
      roleBreakdown: {},
      topPerformers: [],
      attendanceIssues: [],
      salaryBreakdown: {
        totalBaseSalary: 0,
        totalOvertimePay: 0,
        totalDeductions: 0,
        totalNetPay: 0
      }
    };
    
    const employeeDetails = [];
    
    employees.forEach(emp => {
      // Filter attendance within date range
      const attendanceInRange = emp.attendance.filter(att => 
        att.date >= start && att.date <= end
      );
      
      const presentDays = attendanceInRange.filter(att => att.isPresent).length;
      const absentDays = attendanceInRange.filter(att => !att.isPresent).length;
      const totalHours = attendanceInRange.reduce((sum, att) => sum + (att.hoursWorked || 0), 0);
      const overtimeHours = attendanceInRange.reduce((sum, att) => sum + (att.overtimeHours || 0), 0);
      const lateCount = attendanceInRange.filter(att => att.status === 'late').length;
      const earlyLeaveCount = attendanceInRange.filter(att => att.status === 'early-leave').length;
      
      // Calculate attendance percentage
      const workingDays = presentDays + absentDays;
      const attendancePercentage = workingDays > 0 ? Math.round((presentDays / workingDays) * 100) : 0;
      const punctualityScore = presentDays > 0 ? Math.round(((presentDays - lateCount - earlyLeaveCount) / presentDays) * 100) : 0;
      
      // Simplified salary calculation for report period
      const dailyBaseSalary = emp.salary.base / 30;
      const basePay = dailyBaseSalary * presentDays;
      const overtimePay = (emp.salary.overtime || emp.hourlyRate * 1.5 || 0) * overtimeHours;
      const grossPay = basePay + overtimePay + (emp.salary.bonus || 0);
      const netPay = grossPay - (emp.salary.deductions || 0);
      
      // Update summary
      report.summary.totalPresent += presentDays;
      report.summary.totalAbsent += absentDays;
      report.summary.totalHours += totalHours;
      report.summary.totalOvertimeHours += overtimeHours;
      report.summary.totalSalaryPaid += netPay;
      
      // Update salary breakdown
      report.salaryBreakdown.totalBaseSalary += basePay;
      report.salaryBreakdown.totalOvertimePay += overtimePay;
      report.salaryBreakdown.totalDeductions += (emp.salary.deductions || 0);
      report.salaryBreakdown.totalNetPay += netPay;
      
      // Department breakdown
      if (!report.departmentBreakdown[emp.department]) {
        report.departmentBreakdown[emp.department] = {
          employees: 0,
          totalPresent: 0,
          totalHours: 0,
          averageAttendance: 0,
          totalSalary: 0
        };
      }
      const deptStats = report.departmentBreakdown[emp.department];
      deptStats.employees++;
      deptStats.totalPresent += presentDays;
      deptStats.totalHours += totalHours;
      deptStats.totalSalary += netPay;
      
      // Employee details for further analysis
      employeeDetails.push({
        id: emp._id,
        name: emp.name,
        employeeId: emp.employeeId,
        department: emp.department,
        role: emp.role,
        attendancePercentage,
        punctualityScore,
        presentDays,
        absentDays,
        totalHours,
        overtimeHours,
        lateCount,
        earlyLeaveCount,
        netPay,
        performanceScore: Math.round((attendancePercentage * 0.4 + punctualityScore * 0.3 + Math.min(totalHours/160, 1) * 100 * 0.3) * 100) / 100
      });
    });
    
    // Calculate department averages
    Object.keys(report.departmentBreakdown).forEach(dept => {
      const stats = report.departmentBreakdown[dept];
      const deptEmployees = employeeDetails.filter(emp => emp.department === dept);
      stats.averageAttendance = Math.round(deptEmployees.reduce((sum, emp) => sum + emp.attendancePercentage, 0) / deptEmployees.length);
    });
    
    // Top performers (top 10 by performance score)
    report.topPerformers = employeeDetails
      .sort((a, b) => b.performanceScore - a.performanceScore)
      .slice(0, 10)
      .map(emp => ({
        name: emp.name,
        employeeId: emp.employeeId,
        department: emp.department,
        role: emp.role,
        performanceScore: emp.performanceScore,
        attendancePercentage: emp.attendancePercentage,
        punctualityScore: emp.punctualityScore
      }));
    
    // Attendance issues
    report.attendanceIssues = employeeDetails
      .filter(emp => emp.attendancePercentage < 80 || emp.lateCount > 5)
      .map(emp => ({
        name: emp.name,
        employeeId: emp.employeeId,
        department: emp.department,
        role: emp.role,
        attendancePercentage: emp.attendancePercentage,
        lateCount: emp.lateCount,
        earlyLeaveCount: emp.earlyLeaveCount,
        issues: [
          ...(emp.attendancePercentage < 80 ? [`Low attendance: ${emp.attendancePercentage}%`] : []),
          ...(emp.lateCount > 5 ? [`Frequent late arrivals: ${emp.lateCount} times`] : []),
          ...(emp.earlyLeaveCount > 3 ? [`Early leaves: ${emp.earlyLeaveCount} times`] : [])
        ]
      }));
    
    // Round summary numbers
    Object.keys(report.summary).forEach(key => {
      if (typeof report.summary[key] === 'number') {
        report.summary[key] = Math.round(report.summary[key]);
      }
    });
    
    Object.keys(report.salaryBreakdown).forEach(key => {
      report.salaryBreakdown[key] = Math.round(report.salaryBreakdown[key]);
    });
    
    // Include detailed employee data if requested
    if (reportType === 'detailed') {
      report.employeeDetails = employeeDetails;
    }
    
    sendResponse(res, 200, true, 'Comprehensive report generated successfully', report);
  } catch (error) {
    handleError(res, error, 'Failed to generate comprehensive report');
  }
});

// Bulk check-in
router.post('/bulk/checkin', async (req, res) => {
  try {
    const { employeeIds, workLocation = 'dining', location } = req.body;
    
    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      return sendResponse(res, 400, false, 'Employee IDs array is required');
    }

    if (employeeIds.length > 50) {
      return sendResponse(res, 400, false, 'Maximum 50 employees can be processed at once');
    }

    const results = [];
    const errors = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const employees = await Employee.find({
      _id: { $in: employeeIds },
      isActive: true
    });

    for (const employee of employees) {
      try {
        const existingAttendance = employee.attendance.find(
          att => att.date.toDateString() === today.toDateString()
        );

        if (existingAttendance && existingAttendance.loginTime) {
          errors.push({ 
            employeeId: employee.employeeId, 
            name: employee.name,
            error: 'Already checked in today' 
          });
          continue;
        }

        // Calculate late status
        const shiftStart = employee.shiftTiming.startTime || '09:00';
        const [startHour, startMinute] = shiftStart.split(':').map(Number);
        const shiftStartTime = new Date(today);
        shiftStartTime.setHours(startHour, startMinute, 0, 0);
        
        const lateMinutes = Math.max(0, Math.floor((now - shiftStartTime) / (1000 * 60)));
        const status = lateMinutes > 15 ? 'late' : 'present';

        const attendanceData = {
          date: today,
          loginTime: now,
          isPresent: true,
          status: status,
          lateMinutes: lateMinutes,
          workLocation: workLocation,
          breaks: [],
          totalBreakTime: 0
        };

        if (location) {
          attendanceData.checkInLocation = {
            latitude: location.latitude,
            longitude: location.longitude,
            address: location.address || 'Bulk check-in location'
          };
        }

        if (existingAttendance) {
          Object.assign(existingAttendance, attendanceData);
        } else {
          employee.attendance.push(attendanceData);
        }

        employee.lastLogin = now;
        await employee.save();

        results.push({ 
          employeeId: employee.employeeId, 
          name: employee.name, 
          loginTime: now,
          status: status,
          lateMinutes: lateMinutes
        });
      } catch (error) {
        errors.push({ 
          employeeId: employee.employeeId || 'unknown', 
          name: employee.name || 'unknown',
          error: error.message 
        });
      }
    }

    sendResponse(res, 200, true, 'Bulk check-in completed', {
      successful: results,
      failed: errors,
      summary: {
        total: employeeIds.length,
        successful: results.length,
        failed: errors.length,
        successRate: Math.round((results.length / employeeIds.length) * 100)
      }
    });
  } catch (error) {
    handleError(res, error, 'Bulk check-in failed');
  }
});

// Export data
router.get('/export/:format', async (req, res) => {
  try {
    const { format } = req.params;
    const { month, year, department, role } = req.query;

    if (!['json', 'csv'].includes(format)) {
      return sendResponse(res, 400, false, 'Invalid export format. Use json or csv');
    }

    const currentMonth = month || (new Date().getMonth() + 1);
    const currentYear = year || new Date().getFullYear();

    let query = { isActive: true };
    if (department) query.department = department;
    if (role) query.role = role;

    const employees = await Employee.find(query).select('-password').lean();
    
    const exportData = employees.map(emp => {
      const monthlyData = Employee.schema.methods.getMonthlyAttendance.call(emp, currentMonth, currentYear);
      const salaryData = Employee.schema.methods.calculateSalary.call(emp, currentMonth, currentYear);
      
      return {
        employeeId: emp.employeeId,
        name: emp.name,
        email: emp.email,
        phone: emp.phone,
        role: emp.role,
        department: emp.department,
        joinDate: emp.joinDate,
        baseSalary: emp.salary.base,
        presentDays: monthlyData.presentDays,
        absentDays: monthlyData.absentDays,
        totalHours: monthlyData.totalHours,
        overtimeHours: monthlyData.overtimeHours || 0,
        attendancePercentage: monthlyData.attendancePercentage,
        netSalary: salaryData.netSalary || salaryData.grossSalary
      };
    });

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `employees_${currentMonth}_${currentYear}_${timestamp}`;

    if (format === 'csv') {
      if (exportData.length === 0) {
        return sendResponse(res, 404, false, 'No data to export');
      }
      
      const csvHeader = Object.keys(exportData[0]).join(',');
      const csvRows = exportData.map(row => 
        Object.values(row).map(value => 
          typeof value === 'string' && value.includes(',') ? `"${value}"` : value
        ).join(',')
      );
      const csvContent = [csvHeader, ...csvRows].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}.csv`);
      return res.send(csvContent);
    }

    // JSON export
    sendResponse(res, 200, true, 'Employee data exported successfully', {
      period: `${currentMonth}/${currentYear}`,
      exportDate: new Date().toISOString(),
      filters: { department, role },
      data: exportData
    });
  } catch (error) {
    handleError(res, error, 'Failed to export employee data');
  }
});

// Health check
router.get('/health', (req, res) => {
  sendResponse(res, 200, true, 'Employee service is healthy', {
    timestamp: new Date().toISOString(),
    service: 'employee-management',
    version: '2.0.0',
    status: 'operational'
  });
});

module.exports = router;