const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Break schema for tracking break times
const breakSchema = new mongoose.Schema({
  startTime: {
    type: Date,
    required: true
  },
  endTime: Date,
  duration: {
    type: Number, // in minutes
    default: 0
  },
  type: {
    type: String,
    enum: ['lunch', 'tea', 'dinner', 'other'],
    default: 'other'
  }
});

// Enhanced attendance schema with restaurant-specific features
const attendanceSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    index: true
  },
  loginTime: Date,
  logoutTime: Date,
  isPresent: {
    type: Boolean,
    default: false
  },
  hoursWorked: {
    type: Number,
    default: 0
  },
  overtimeHours: {
    type: Number,
    default: 0
  },
  breaks: [breakSchema],
  totalBreakTime: {
    type: Number, // in minutes
    default: 0
  },
  // Restaurant specific fields
  lateMinutes: {
    type: Number,
    default: 0
  },
  earlyLeaveMinutes: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'half-day', 'late', 'early-leave', 'overtime', 'sick-leave', 'casual-leave', 'emergency-leave'],
    default: 'absent'
  },
  leaveType: {
    type: String,
    enum: ['sick', 'casual', 'emergency', 'maternity', 'paternity', 'annual', 'unpaid'],
    required: function() {
      return ['sick-leave', 'casual-leave', 'emergency-leave'].includes(this.status);
    }
  },
  leaveReason: String,
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  notes: String,
  workLocation: {
    type: String,
    enum: ['kitchen', 'dining', 'counter', 'delivery', 'cleaning', 'store'],
    default: 'dining'
  },
  // Performance tracking
  customerRating: {
    type: Number,
    min: 1,
    max: 5
  },
  tasksCompleted: [{
    task: String,
    completedAt: Date,
    rating: Number
  }],
  // Geolocation for check-in/out verification
  checkInLocation: {
    latitude: Number,
    longitude: Number,
    address: String
  },
  checkOutLocation: {
    latitude: Number,
    longitude: Number,
    address: String
  }
}, {
  timestamps: true
});

// Leave balance schema
const leaveBalanceSchema = new mongoose.Schema({
  year: {
    type: Number,
    required: true
  },
  casual: {
    total: { type: Number, default: 12 },
    used: { type: Number, default: 0 },
    remaining: { type: Number, default: 12 }
  },
  sick: {
    total: { type: Number, default: 12 },
    used: { type: Number, default: 0 },
    remaining: { type: Number, default: 12 }
  },
  annual: {
    total: { type: Number, default: 21 },
    used: { type: Number, default: 0 },
    remaining: { type: Number, default: 21 }
  },
  emergency: {
    total: { type: Number, default: 3 },
    used: { type: Number, default: 0 },
    remaining: { type: Number, default: 3 }
  }
});

// Training record schema
const trainingSchema = new mongoose.Schema({
  course: {
    type: String,
    required: true
  },
  completedDate: Date,
  certificateUrl: String,
  validUntil: Date,
  score: Number,
  instructor: String,
  mandatory: {
    type: Boolean,
    default: false
  }
});

// Performance review schema
const performanceSchema = new mongoose.Schema({
  reviewDate: {
    type: Date,
    required: true
  },
  reviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  ratings: {
    punctuality: { type: Number, min: 1, max: 5 },
    workQuality: { type: Number, min: 1, max: 5 },
    teamwork: { type: Number, min: 1, max: 5 },
    customerService: { type: Number, min: 1, max: 5 },
    hygiene: { type: Number, min: 1, max: 5 },
    initiative: { type: Number, min: 1, max: 5 }
  },
  overallRating: {
    type: Number,
    min: 1,
    max: 5
  },
  strengths: [String],
  improvements: [String],
  goals: [String],
  comments: String,
  nextReviewDate: Date
});

// Enhanced employee schema
const employeeSchema = new mongoose.Schema({
  employeeId: {
    type: String,
    unique: true,
    uppercase: true
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    match: [/^[+]?[\d\s\-\(\)]{10,15}$/, 'Please enter a valid phone number']
  },
  alternatePhone: {
    type: String,
    match: [/^[+]?[\d\s\-\(\)]{10,15}$/, 'Please enter a valid alternate phone number']
  },
  
  // Authentication
  password: {
    type: String,
    // required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  role: {
    type: String,
    required: [true, 'Role is required'],
    enum: {
      values: ['waiter', 'cook', 'chef', 'cashier', 'cleaner', 'manager', 'supervisor', 'host', 'bartender', 'delivery-boy', 'security'],
      message: '{VALUE} is not a valid role'
    }
  },
  permissions: [{
    type: String,
    enum: ['view_employees', 'manage_employees', 'view_attendance', 'manage_attendance', 'view_reports', 'manage_inventory', 'manage_orders', 'manage_customers']
  }],
  
  // Employment details
  salary: {
    base: {
      type: Number,
      required: [true, 'Base salary is required'],
      min: [0, 'Salary cannot be negative']
    },
    overtime: {
      type: Number,
      default: 0
    },
    bonus: {
      type: Number,
      default: 0
    },
    deductions: {
      type: Number,
      default: 0
    }
  },
  payrollType: {
    type: String,
    enum: ['monthly', 'weekly', 'daily', 'hourly'],
    default: 'monthly'
  },
  hourlyRate: Number,
  
  joinDate: {
    type: Date,
    default: Date.now
  },
  probationEndDate: Date,
  contractType: {
    type: String,
    enum: ['permanent', 'temporary', 'contract', 'part-time'],
    default: 'permanent'
  },
  terminationDate: Date,
  terminationReason: String,
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Personal Information
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: {
      type: String,
      default: 'India'
    }
  },
  emergencyContact: {
    name: String,
    phone: {
      type: String,
      match: [/^[+]?[\d\s\-\(\)]{10,15}$/, 'Please enter a valid emergency contact number']
    },
    relationship: String,
    address: String
  },
  
  // Restaurant specific fields
  department: {
    type: String,
    enum: ['kitchen', 'service', 'management', 'maintenance', 'security', 'delivery'],
    default: 'service'
  },
  shiftTiming: {
    type: {
      type: String,
      enum: ['fixed', 'flexible', 'rotating'],
      default: 'fixed'
    },
    startTime: {
      type: String,
      default: '09:00'
    },
    endTime: {
      type: String,
      default: '18:00'
    },
    breakDuration: {
      type: Number, // in minutes
      default: 60
    },
    weeklyOffs: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }]
  },
  
  // Skills and certifications
  skills: [String],
  certifications: [trainingSchema],
  
  // Additional details
  profilePicture: String,
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
  },
  dateOfBirth: Date,
  gender: {
    type: String,
    enum: ['male', 'female', 'other']
  },
  maritalStatus: {
    type: String,
    enum: ['single', 'married', 'divorced', 'widowed']
  },
  nationality: {
    type: String,
    default: 'Indian'
  },
  
  // Professional details
  qualification: String,
  experience: {
    total: {
      type: Number,
      min: 0,
      default: 0
    },
    previous: [{
      company: String,
      role: String,
      duration: String,
      salary: Number,
      reasonForLeaving: String
    }]
  },
  
  // Bank details for salary
  bankDetails: {
    accountNumber: String,
    ifscCode: String,
    bankName: String,
    branchName: String,
    accountHolderName: String
  },
  
  // Government IDs
  documents: {
    aadhar: String,
    pan: String,
    passport: String,
    drivingLicense: String,
    voterID: String
  },
  
  // Performance and attendance
  attendance: [attendanceSchema],
  leaveBalance: [leaveBalanceSchema],
  performanceReviews: [performanceSchema],
  
  // Restaurant operations
  preferredWorkAreas: [{
    type: String,
    enum: ['kitchen', 'dining', 'counter', 'delivery', 'cleaning', 'store']
  }],
  languages: [String],
  specializations: [String], // e.g., 'italian-cuisine', 'cocktail-making', 'cash-handling'
  
  // System fields
  lastLogin: Date,
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date,
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  
  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
employeeSchema.index({ email: 1 });
employeeSchema.index({ employeeId: 1 });
employeeSchema.index({ role: 1, isActive: 1 });
employeeSchema.index({ department: 1, isActive: 1 });
employeeSchema.index({ 'attendance.date': 1 });
employeeSchema.index({ joinDate: 1 });
employeeSchema.index({ name: 'text', email: 'text', employeeId: 'text' });

// Virtual for account lock status
employeeSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Virtual for full name display
employeeSchema.virtual('displayName').get(function() {
  return `${this.name} (${this.employeeId})`;
});

// Virtual for age calculation
employeeSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

// Virtual for current leave balance
employeeSchema.virtual('currentLeaveBalance').get(function() {
  const currentYear = new Date().getFullYear();
  return this.leaveBalance.find(lb => lb.year === currentYear) || {
    year: currentYear,
    casual: { total: 12, used: 0, remaining: 12 },
    sick: { total: 12, used: 0, remaining: 12 },
    annual: { total: 21, used: 0, remaining: 21 },
    emergency: { total: 3, used: 0, remaining: 3 }
  };
});

// Pre-save middleware
employeeSchema.pre('save', async function(next) {
  try {
    // Generate employee ID
    if (!this.employeeId) {
      const count = await this.constructor.countDocuments();
      const rolePrefix = this.role.toUpperCase().substring(0, 3);
      this.employeeId = `${rolePrefix}${String(count + 1).padStart(4, '0')}`;
    }
    
    // Hash password if modified
    if (this.isModified('password')) {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    }
    
    // Initialize leave balance for current year
    const currentYear = new Date().getFullYear();
    const existingBalance = this.leaveBalance.find(lb => lb.year === currentYear);
    if (!existingBalance) {
      this.leaveBalance.push({
        year: currentYear,
        casual: { total: 12, used: 0, remaining: 12 },
        sick: { total: 12, used: 0, remaining: 12 },
        annual: { total: 21, used: 0, remaining: 21 },
        emergency: { total: 3, used: 0, remaining: 3 }
      });
    }
    
    // Set probation end date
    if (this.isNew && !this.probationEndDate) {
      this.probationEndDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
employeeSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to handle login attempts
employeeSchema.methods.incLoginAttempts = function() {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: {
        loginAttempts: 1,
        lockUntil: 1
      }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = {
      lockUntil: Date.now() + 2 * 60 * 60 * 1000 // 2 hours
    };
  }
  
  return this.updateOne(updates);
};

// Method to calculate monthly attendance with enhanced features
employeeSchema.methods.getMonthlyAttendance = function(month, year) {
  const monthAttendance = this.attendance.filter(att => {
    const attDate = new Date(att.date);
    return attDate.getMonth() === parseInt(month) - 1 && 
           attDate.getFullYear() === parseInt(year);
  });

  const presentDays = monthAttendance.filter(att => att.isPresent).length;
  const totalHours = monthAttendance.reduce((sum, att) => sum + (att.hoursWorked || 0), 0);
  const overtimeHours = monthAttendance.reduce((sum, att) => sum + (att.overtimeHours || 0), 0);
  const totalBreakTime = monthAttendance.reduce((sum, att) => sum + (att.totalBreakTime || 0), 0);
  const lateCount = monthAttendance.filter(att => att.status === 'late').length;
  const earlyLeaveCount = monthAttendance.filter(att => att.status === 'early-leave').length;
  
  const totalWorkingDays = new Date(year, month, 0).getDate();
  const weekends = this.getWeekendDays(month, year);
  const actualWorkingDays = totalWorkingDays - weekends;

  return {
    attendance: monthAttendance,
    presentDays,
    absentDays: actualWorkingDays - presentDays,
    totalHours: Math.round(totalHours * 100) / 100,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
    totalBreakTime: Math.round(totalBreakTime / 60 * 100) / 100, // Convert to hours
    averageHours: presentDays > 0 ? Math.round((totalHours / presentDays) * 100) / 100 : 0,
    attendancePercentage: actualWorkingDays > 0 ? Math.round((presentDays / actualWorkingDays) * 100) : 0,
    lateCount,
    earlyLeaveCount,
    punctualityScore: presentDays > 0 ? Math.round(((presentDays - lateCount - earlyLeaveCount) / presentDays) * 100) : 0
  };
};

// Method to get weekend days count
employeeSchema.methods.getWeekendDays = function(month, year) {
  const weeklyOffs = this.shiftTiming.weeklyOffs || ['sunday'];
  const daysInMonth = new Date(year, month, 0).getDate();
  let weekendCount = 0;
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    // FIX: Change 'lowercase' to 'long' and then convert to lowercase
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    if (weeklyOffs.includes(dayName)) {
      weekendCount++;
    }
  }
  
  return weekendCount;
};
// Enhanced salary calculation with overtime and deductions
employeeSchema.methods.calculateSalary = function(month, year) {
  const monthlyData = this.getMonthlyAttendance(month, year);
  const baseSalary = this.salary.base || 0;
  
  if (this.payrollType === 'monthly') {
    const attendanceMultiplier = monthlyData.attendancePercentage / 100;
    const basePay = baseSalary * attendanceMultiplier;
    const overtimePay = (this.salary.overtime || 0) * (monthlyData.overtimeHours || 0);
    const bonus = this.salary.bonus || 0;
    const deductions = this.salary.deductions || 0;
    
    const grossSalary = basePay + overtimePay + bonus;
    const netSalary = grossSalary - deductions;
    
    return {
      baseSalary,
      presentDays: monthlyData.presentDays,
      totalWorkingDays: monthlyData.presentDays + monthlyData.absentDays,
      attendancePercentage: monthlyData.attendancePercentage,
      basePay: Math.round(basePay),
      overtimeHours: monthlyData.overtimeHours || 0,
      overtimePay: Math.round(overtimePay),
      bonus,
      deductions,
      grossSalary: Math.round(grossSalary),
      netSalary: Math.round(netSalary)
    };
  } else if (this.payrollType === 'hourly') {
    const hourlyRate = this.hourlyRate || 0;
    const regularPay = (monthlyData.totalHours || 0) * hourlyRate;
    const overtimePay = (monthlyData.overtimeHours || 0) * hourlyRate * 1.5; // 1.5x for overtime
    const grossSalary = regularPay + overtimePay + (this.salary.bonus || 0);
    const netSalary = grossSalary - (this.salary.deductions || 0);
    
    return {
      hourlyRate,
      totalHours: monthlyData.totalHours || 0,
      overtimeHours: monthlyData.overtimeHours || 0,
      regularPay: Math.round(regularPay),
      overtimePay: Math.round(overtimePay),
      bonus: this.salary.bonus || 0,
      deductions: this.salary.deductions || 0,
      grossSalary: Math.round(grossSalary),
      netSalary: Math.round(netSalary),
      basePay: Math.round(regularPay), // For consistency with monthly
      baseSalary: Math.round(regularPay) // For consistency with monthly
    };
  }
  
  // Fallback for other payroll types
  return {
    baseSalary: baseSalary,
    basePay: baseSalary,
    presentDays: monthlyData.presentDays,
    totalWorkingDays: monthlyData.presentDays + monthlyData.absentDays,
    attendancePercentage: monthlyData.attendancePercentage,
    overtimeHours: monthlyData.overtimeHours || 0,
    overtimePay: 0,
    bonus: this.salary.bonus || 0,
    deductions: this.salary.deductions || 0,
    grossSalary: baseSalary,
    netSalary: baseSalary - (this.salary.deductions || 0)
  };
};


// Method to get today's attendance
employeeSchema.methods.getTodayAttendance = function() {
  const today = new Date();
  const todayString = today.toISOString().split('T')[0];
  
  return this.attendance.find(
    att => att.date.toISOString().split('T')[0] === todayString
  );
};

// Method to check if employee can take leave
employeeSchema.methods.canTakeLeave = function(leaveType, days = 1) {
  const currentBalance = this.currentLeaveBalance;
  const typeBalance = currentBalance[leaveType];
  
  if (!typeBalance) return false;
  return typeBalance.remaining >= days;
};

// Method to apply leave
employeeSchema.methods.applyLeave = function(leaveType, days = 1) {
  const currentYear = new Date().getFullYear();
  let yearBalance = this.leaveBalance.find(lb => lb.year === currentYear);
  
  if (!yearBalance) {
    yearBalance = {
      year: currentYear,
      casual: { total: 12, used: 0, remaining: 12 },
      sick: { total: 12, used: 0, remaining: 12 },
      annual: { total: 21, used: 0, remaining: 21 },
      emergency: { total: 3, used: 0, remaining: 3 }
    };
    this.leaveBalance.push(yearBalance);
  }
  
  if (yearBalance[leaveType] && yearBalance[leaveType].remaining >= days) {
    yearBalance[leaveType].used += days;
    yearBalance[leaveType].remaining -= days;
    return true;
  }
  
  return false;
};

// Static method to get comprehensive attendance summary
employeeSchema.statics.getTodayAttendanceSummary = async function() {
  const today = new Date();
  const todayString = today.toISOString().split('T')[0];
  
  const employees = await this.find({ isActive: true })
    .select('name employeeId role department attendance shiftTiming')
    .lean();
  
  const summary = employees.map(emp => {
    const todayAttendance = emp.attendance.find(
      att => new Date(att.date).toISOString().split('T')[0] === todayString
    );
    
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
      shiftStart: emp.shiftTiming?.startTime || '09:00',
      shiftEnd: emp.shiftTiming?.endTime || '18:00'
    };
  });

  const presentCount = summary.filter(emp => emp.isPresent).length;
  const lateCount = summary.filter(emp => emp.status === 'late').length;
  const overtimeCount = summary.filter(emp => emp.overtimeHours > 0).length;
  const totalEmployees = employees.length;

  // Department-wise summary
  const departmentSummary = summary.reduce((acc, emp) => {
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

  return {
    date: todayString,
    attendanceSummary: summary,
    summary: {
      present: presentCount,
      absent: totalEmployees - presentCount,
      late: lateCount,
      overtime: overtimeCount,
      total: totalEmployees,
      attendancePercentage: totalEmployees > 0 ? Math.round((presentCount / totalEmployees) * 100) : 0
    },
    departmentSummary
  };
};

// Static method for advanced analytics
employeeSchema.statics.getAdvancedAnalytics = async function(startDate, endDate) {
  const employees = await this.find({ isActive: true });
  
  const analytics = {
    totalEmployees: employees.length,
    averageAttendance: 0,
    topPerformers: [],
    attendanceTrends: {},
    departmentPerformance: {},
    lateComers: [],
    overtimeAnalysis: {}
  };
  
  // Calculate analytics for each employee
  employees.forEach(emp => {
    const attendanceInRange = emp.attendance.filter(att => 
      att.date >= startDate && att.date <= endDate
    );
    
    // Add to analytics calculations
    // Implementation would continue here...
  });
  
  return analytics;
};

module.exports = mongoose.model('Employee', employeeSchema);