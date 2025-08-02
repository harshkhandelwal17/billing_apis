// const mongoose = require('mongoose');

// const billItemSchema = new mongoose.Schema({
//   menuItem: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'MenuItem',
//     required: true
//   },
//   name: String,
//   price: Number,
//   quantity: {
//     type: Number,
//     required: true,
//     min: 1
//   },
//   total: Number
// });

// const billSchema = new mongoose.Schema({
//   billNumber: {
//     type: String,
//     required: true,
//     unique: true
//   },
//   customerName: {
//     type: String,
//     default: 'Walk-in Customer'
//   },
//   customerPhone: {
//     type: String,
//     default: null
//   },
//   items: [billItemSchema],
//   subtotal: {
//     type: Number,
//     required: true
//   },
//   gst: {
//     type: Number,
//     default: 0
//   },
//   discount: {
//     type: Number,
//     default: 0
//   },
//   total: {
//     type: Number,
//     required: true
//   },
//   paymentMethod: {
//     type: String,
//     enum: ['cash', 'card', 'upi', 'online'],
//     default: 'cash'
//   },
//   status: {
//     type: String,
//     enum: ['pending', 'paid', 'cancelled'],
//     default: 'paid'
//   },
//   createdBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   isPrinted: {
//     type: Boolean,
//     default: false
//   }
// }, {
//   timestamps: true
// });

// // Generate bill number before saving
// billSchema.pre('save', async function(next) {
//   if (!this.billNumber) {
//     const today = new Date();
//     const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
//     const count = await this.constructor.countDocuments({
//       createdAt: {
//         $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
//         $lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
//       }
//     });
//     this.billNumber = `B${dateStr}${String(count + 1).padStart(3, '0')}`;
//   }
//   next();
// });

// module.exports = mongoose.model('Bill', billSchema);
// models/Bill.js - Fixed Bill Model with Auto billNumber Generation
const mongoose = require('mongoose');

const billItemSchema = new mongoose.Schema({
  menuItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  total: {
    type: Number,
    required: true,
    min: 0
  }
});

const billSchema = new mongoose.Schema({
  billNumber: {
    type: String,
    unique: true,
    sparse: true // Allows multiple documents with null billNumber during creation
  },
  customerName: {
    type: String,
    default: 'Walk-in Customer',
    trim: true
  },
  customerPhone: {
    type: String,
    default: null,
    trim: true
  },
  tableNumber: {
    type: String,
    default: null
  },
  items: {
    type: [billItemSchema],
    required: true,
    validate: {
      validator: function(items) {
        return items && items.length > 0;
      },
      message: 'Bill must have at least one item'
    }
  },
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  gst: {
    type: Number,
    default: 0,
    min: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'upi', 'online'],
    default: 'cash'
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'cancelled'],
    default: 'paid'
  },
  isPrinted: {
    type: Boolean,
    default: false
  },
  printedAt: {
    type: Date,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  cancelledAt: {
    type: Date,
    default: null
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  notes: {
    type: String,
    default: '',
    trim: true
  }
}, {
  timestamps: true
});

// Create indexes for better performance
billSchema.index({ billNumber: 1 });
billSchema.index({ createdAt: -1 });
billSchema.index({ status: 1 });
billSchema.index({ paymentMethod: 1 });
billSchema.index({ customerName: 1 });
billSchema.index({ createdBy: 1 });

// Pre-save middleware to generate billNumber
billSchema.pre('save', async function(next) {
  // Only generate billNumber if it's not already set (new document)
  if (!this.billNumber) {
    try {
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
      
      // Get start and end of today
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      
      // Count today's bills to generate sequence number
      const todayBillsCount = await this.constructor.countDocuments({
        createdAt: {
          $gte: startOfDay,
          $lt: endOfDay
        }
      });
      
      // Generate sequence number with padding
      const sequenceNumber = String(todayBillsCount + 1).padStart(3, '0');
      
      // Create bill number: B + YYYYMMDD + 001
      this.billNumber = `B${dateStr}${sequenceNumber}`;
      
      console.log(`Generated bill number: ${this.billNumber}`);
    } catch (error) {
      console.error('Error generating bill number:', error);
      // Fallback: use timestamp-based bill number
      this.billNumber = `B${Date.now()}`;
    }
  }
  
  // Validate and calculate totals
  if (this.items && this.items.length > 0) {
    const calculatedSubtotal = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Auto-calculate GST if not provided
    if (!this.gst) {
      this.gst = Math.round((calculatedSubtotal * 0.18) * 100) / 100;
    }
    
    // Auto-calculate total if not provided
    if (!this.total || this.total === 0) {
      this.total = calculatedSubtotal + this.gst - (this.discount || 0);
    }
    
    // Update item totals
    this.items.forEach(item => {
      if (!item.total || item.total === 0) {
        item.total = item.price * item.quantity;
      }
    });
  }
  
  next();
});

// Pre-validate middleware for additional checks
billSchema.pre('validate', function(next) {
  // Ensure discount doesn't exceed subtotal
  if (this.discount && this.subtotal && this.discount > this.subtotal) {
    this.discount = this.subtotal;
  }
  
  // Ensure total is correct
  if (this.subtotal && this.gst !== undefined && this.discount !== undefined) {
    const calculatedTotal = this.subtotal + this.gst - this.discount;
    if (Math.abs(this.total - calculatedTotal) > 0.01) { // Allow for small rounding differences
      this.total = Math.round(calculatedTotal * 100) / 100;
    }
  }
  
  next();
});

// Instance method to calculate totals
billSchema.methods.calculateTotals = function() {
  if (!this.items || this.items.length === 0) {
    return {
      subtotal: 0,
      gst: 0,
      total: 0
    };
  }
  
  const subtotal = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const gst = Math.round((subtotal * 0.18) * 100) / 100;
  const total = subtotal + gst - (this.discount || 0);
  
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    gst,
    total: Math.round(total * 100) / 100
  };
};

// Instance method to get formatted bill data for printing
billSchema.methods.getFormattedData = function() {
  return {
    billNumber: this.billNumber,
    date: this.createdAt.toLocaleDateString(),
    time: this.createdAt.toLocaleTimeString(),
    customerName: this.customerName,
    customerPhone: this.customerPhone,
    tableNumber: this.tableNumber,
    items: this.items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price.toFixed(2),
      total: item.total.toFixed(2)
    })),
    subtotal: this.subtotal.toFixed(2),
    gst: this.gst.toFixed(2),
    discount: this.discount.toFixed(2),
    total: this.total.toFixed(2),
    paymentMethod: this.paymentMethod.toUpperCase(),
    status: this.status.toUpperCase()
  };
};

// Static method to get today's bills summary
billSchema.statics.getTodaySummary = async function() {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  const bills = await this.find({
    createdAt: { $gte: startOfDay, $lt: endOfDay },
    status: 'paid'
  });

  const totalRevenue = bills.reduce((sum, bill) => sum + bill.total, 0);
  const totalBills = bills.length;

  return {
    date: today.toISOString().split('T')[0],
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalBills,
    averageBill: totalBills > 0 ? Math.round((totalRevenue / totalBills) * 100) / 100 : 0
  };
};

// Static method to find bills by date range
billSchema.statics.findByDateRange = function(startDate, endDate, options = {}) {
  const query = {
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
    }
  };

  if (options.status) {
    query.status = options.status;
  }

  if (options.paymentMethod) {
    query.paymentMethod = options.paymentMethod;
  }

  return this.find(query).sort({ createdAt: -1 });
};

// Virtual for formatted bill number
billSchema.virtual('formattedBillNumber').get(function() {
  return this.billNumber || 'PENDING';
});

// Virtual for bill age in days
billSchema.virtual('ageInDays').get(function() {
  const now = new Date();
  const created = new Date(this.createdAt);
  const diffTime = Math.abs(now - created);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Ensure virtuals are included in JSON output
billSchema.set('toJSON', { virtuals: true });
billSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Bill', billSchema);