// const express = require('express');
// const Bill = require('../models/Bill');
// const MenuItem = require('../models/MenuItem');
// const auth = require('../middleware/auth');

// const router = express.Router();

// // Get all bills
// router.get('/', auth, async (req, res) => {
//   try {
//     const { 
//       startDate, 
//       endDate, 
//       status, 
//       paymentMethod,
//       page = 1,
//       limit = 50
//     } = req.query;

//     let query = {};
    
//     if (startDate && endDate) {
//       query.createdAt = {
//         $gte: new Date(startDate),
//         $lte: new Date(endDate)
//       };
//     }
    
//     if (status) query.status = status;
//     if (paymentMethod) query.paymentMethod = paymentMethod;

//     const bills = await Bill.find(query)
//       .populate('createdBy', 'username')
//       .sort({ createdAt: -1 })
//       .limit(limit * 1)
//       .skip((page - 1) * limit);

//     const total = await Bill.countDocuments(query);

//     res.json({
//       bills,
//       totalPages: Math.ceil(total / limit),
//       currentPage: page,
//       total
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// // Get single bill
// router.get('/:id', auth, async (req, res) => {
//   try {
//     const bill = await Bill.findById(req.params.id)
//       .populate('createdBy', 'username')
//       .populate('items.menuItem', 'name category');
    
//     if (!bill) {
//       return res.status(404).json({ message: 'Bill not found' });
//     }

//     res.json(bill);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// // Create new bill
// router.post('/', auth, async (req, res) => {
//   try {
//     const {
//       customerName,
//       customerPhone,
//       items,
//       discount = 0,
//       paymentMethod = 'cash'
//     } = req.body;

//     // Validate and calculate totals
//     let subtotal = 0;
//     const billItems = [];

//     for (const item of items) {
//       const menuItem = await MenuItem.findById(item.menuItemId);
//       if (!menuItem) {
//         return res.status(400).json({ 
//           message: `Menu item not found: ${item.menuItemId}` 
//         });
//       }

//       if (menuItem.stock < item.quantity) {
//         return res.status(400).json({ 
//           message: `Insufficient stock for ${menuItem.name}` 
//         });
//       }

//       const itemTotal = menuItem.price * item.quantity;
//       subtotal += itemTotal;

//       billItems.push({
//         menuItem: menuItem._id,
//         name: menuItem.name,
//         price: menuItem.price,
//         quantity: item.quantity,
//         total: itemTotal
//       });

//       // Update stock
//       menuItem.stock -= item.quantity;
//       await menuItem.save();
//     }

//     const gst = Math.round((subtotal * 0.18) * 100) / 100; // 18% GST
//     const total = subtotal + gst - discount;

//     const bill = new Bill({
//       customerName,
//       customerPhone,
//       items: billItems,
//       subtotal,
//       gst,
//       discount,
//       total,
//       paymentMethod,
//       createdBy: req.user.userId
//     });

//     await bill.save();
//     await bill.populate('createdBy', 'username');

//     res.status(201).json({
//       message: 'Bill created successfully',
//       bill
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// // Update bill status
// router.patch('/:id/status', auth, async (req, res) => {
//   try {
//     const { status } = req.body;
    
//     const bill = await Bill.findByIdAndUpdate(
//       req.params.id,
//       { status },
//       { new: true }
//     );

//     if (!bill) {
//       return res.status(404).json({ message: 'Bill not found' });
//     }

//     res.json({
//       message: 'Bill status updated successfully',
//       bill
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// // Mark bill as printed
// router.patch('/:id/printed', auth, async (req, res) => {
//   try {
//     const bill = await Bill.findByIdAndUpdate(
//       req.params.id,
//       { isPrinted: true },
//       { new: true }
//     );

//     if (!bill) {
//       return res.status(404).json({ message: 'Bill not found' });
//     }

//     res.json({
//       message: 'Bill marked as printed',
//       bill
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// // Get today's bills summary
// router.get('/summary/today', auth, async (req, res) => {
//   try {
//     const today = new Date();
//     const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
//     const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

//     const bills = await Bill.find({
//       createdAt: { $gte: startOfDay, $lt: endOfDay },
//       status: 'paid'
//     });

//     const totalEarnings = bills.reduce((sum, bill) => sum + bill.total, 0);
//     const totalBills = bills.length;
    
//     const paymentBreakdown = bills.reduce((acc, bill) => {
//       acc[bill.paymentMethod] = (acc[bill.paymentMethod] || 0) + bill.total;
//       return acc;
//     }, {});

//     res.json({
//       date: today.toISOString().split('T')[0],
//       totalEarnings,
//       totalBills,
//       paymentBreakdown
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// module.exports = router;
// routes/bills.js - Fixed Bill Routes with Auto billNumber Generation
const express = require('express');
const Bill = require('../models/Bill');
const MenuItem = require('../models/MenuItem');
const auth = require('../middleware/auth');

const router = express.Router();

// Helper function to generate bill number
async function generateBillNumber() {
  try {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    
    // Count today's bills to generate sequence number
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    const todayBillsCount = await Bill.countDocuments({
      createdAt: {
        $gte: startOfDay,
        $lt: endOfDay
      }
    });
    
    const sequenceNumber = String(todayBillsCount + 1).padStart(3, '0');
    return `B${dateStr}${sequenceNumber}`;
  } catch (error) {
    console.error('Error generating bill number:', error);
    // Fallback bill number
    return `B${Date.now()}`;
  }
}

// Get all bills with enhanced filtering
router.get('/', auth, async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      status, 
      paymentMethod,
      customerName,
      page = 1,
      limit = 20
    } = req.query;

    let query = {};
    
    // Date range filter
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
      };
    } else if (startDate) {
      query.createdAt = { $gte: new Date(startDate) };
    } else if (endDate) {
      query.createdAt = { $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)) };
    }
    
    // Other filters
    if (status && status !== 'all') query.status = status;
    if (paymentMethod && paymentMethod !== 'all') query.paymentMethod = paymentMethod;
    if (customerName) {
      query.customerName = { $regex: customerName, $options: 'i' };
    }

    const bills = await Bill.find(query)
      .populate('createdBy', 'username email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Bill.countDocuments(query);

    // Calculate summary statistics
    const totalRevenue = bills.reduce((sum, bill) => sum + (bill.status === 'paid' ? bill.total : 0), 0);
    const averageBill = bills.length > 0 ? totalRevenue / bills.filter(b => b.status === 'paid').length : 0;

    res.json({
      success: true,
      data: bills,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      },
      summary: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        averageBill: Math.round((averageBill || 0) * 100) / 100,
        totalBills: total,
        paidBills: bills.filter(b => b.status === 'paid').length
      },
      message: `Found ${bills.length} bills`
    });
  } catch (error) {
    console.error('Get bills error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch bills',
      error: error.message 
    });
  }
});

// Get single bill with detailed information
router.get('/:id', auth, async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id)
      .populate('createdBy', 'username email')
      .populate('items.menuItem', 'name category image');
    
    if (!bill) {
      return res.status(404).json({ 
        success: false,
        message: 'Bill not found' 
      });
    }

    res.json({
      success: true,
      data: bill,
      message: 'Bill retrieved successfully'
    });
  } catch (error) {
    console.error('Get bill error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch bill',
      error: error.message 
    });
  }
});

// Create new bill with enhanced validation
router.post('/', auth, async (req, res) => {
  try {
    const {
      customerName = 'Walk-in Customer',
      customerPhone,
      items,
      discount = 0,
      paymentMethod = 'cash',
      tableNumber
    } = req.body;

    // Validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Items array is required and cannot be empty' 
      });
    }

    // Validate and calculate totals
    let subtotal = 0;
    const billItems = [];

    for (const item of items) {
      if (!item.menuItemId || !item.quantity || item.quantity <= 0) {
        return res.status(400).json({ 
          success: false,
          message: 'Each item must have menuItemId and valid quantity' 
        });
      }

      const menuItem = await MenuItem.findById(item.menuItemId);
      if (!menuItem) {
        return res.status(400).json({ 
          success: false,
          message: `Menu item not found: ${item.menuItemId}` 
        });
      }

      if (!menuItem.isAvailable) {
        return res.status(400).json({ 
          success: false,
          message: `Menu item "${menuItem.name}" is currently unavailable` 
        });
      }

      if (menuItem.stock < item.quantity) {
        return res.status(400).json({ 
          success: false,
          message: `Insufficient stock for "${menuItem.name}". Available: ${menuItem.stock}, Requested: ${item.quantity}` 
        });
      }

      const itemTotal = menuItem.price * item.quantity;
      subtotal += itemTotal;

      billItems.push({
        menuItem: menuItem._id,
        name: menuItem.name,
        price: menuItem.price,
        quantity: item.quantity,
        total: itemTotal
      });
    }

    // Calculate GST and total
    const gst = Math.round((subtotal * 0.18) * 100) / 100; // 18% GST
    const discountAmount = Math.min(discount, subtotal); // Discount can't exceed subtotal
    const total = subtotal + gst - discountAmount;

    // Generate bill number
    const billNumber = await generateBillNumber();

    // Create bill
    const billData = {
      billNumber,
      customerName: customerName.trim(),
      customerPhone: customerPhone?.trim() || null,
      items: billItems,
      subtotal: Math.round(subtotal * 100) / 100,
      gst: gst,
      discount: discountAmount,
      total: Math.round(total * 100) / 100,
      paymentMethod,
      status: 'paid', // Assuming immediate payment
      createdBy: req.user.userId,
      tableNumber: tableNumber || null
    };

    const bill = new Bill(billData);
    await bill.save();

    // Update stock for each item
    for (const item of items) {
      await MenuItem.findByIdAndUpdate(
        item.menuItemId,
        { $inc: { stock: -item.quantity } },
        { new: true }
      );
    }

    // Populate creator info
    await bill.populate('createdBy', 'username email');

    res.status(201).json({
      success: true,
      data: bill,
      message: 'Bill created successfully'
    });
  } catch (error) {
    console.error('Create bill error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to create bill',
      error: error.message 
    });
  }
});

// Update bill status
router.patch('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['pending', 'paid', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be: pending, paid, or cancelled'
      });
    }

    const bill = await Bill.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    ).populate('createdBy', 'username email');

    if (!bill) {
      return res.status(404).json({ 
        success: false,
        message: 'Bill not found' 
      });
    }

    res.json({
      success: true,
      data: bill,
      message: `Bill status updated to ${status}`
    });
  } catch (error) {
    console.error('Update bill status error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update bill status',
      error: error.message 
    });
  }
});

// Mark bill as printed
router.patch('/:id/printed', auth, async (req, res) => {
  try {
    const bill = await Bill.findByIdAndUpdate(
      req.params.id,
      { 
        isPrinted: true,
        printedAt: new Date()
      },
      { new: true }
    );

    if (!bill) {
      return res.status(404).json({ 
        success: false,
        message: 'Bill not found' 
      });
    }

    res.json({
      success: true,
      data: bill,
      message: 'Bill marked as printed'
    });
  } catch (error) {
    console.error('Mark printed error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to mark bill as printed',
      error: error.message 
    });
  }
});

// Get today's bills summary
router.get('/summary/today', auth, async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const bills = await Bill.find({
      createdAt: { $gte: startOfDay, $lt: endOfDay },
      status: 'paid'
    });

    const totalEarnings = bills.reduce((sum, bill) => sum + bill.total, 0);
    const totalBills = bills.length;
    
    const paymentBreakdown = bills.reduce((acc, bill) => {
      acc[bill.paymentMethod] = (acc[bill.paymentMethod] || 0) + bill.total;
      return acc;
    }, {});

    // Hourly breakdown
    const hourlyBreakdown = {};
    bills.forEach(bill => {
      const hour = new Date(bill.createdAt).getHours();
      hourlyBreakdown[hour] = (hourlyBreakdown[hour] || 0) + bill.total;
    });

    // Top items today
    const itemCount = {};
    bills.forEach(bill => {
      bill.items.forEach(item => {
        if (itemCount[item.name]) {
          itemCount[item.name] += item.quantity;
        } else {
          itemCount[item.name] = item.quantity;
        }
      });
    });

    const topItems = Object.entries(itemCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([name, quantity]) => ({ name, quantity }));

    res.json({
      success: true,
      data: {
        date: today.toISOString().split('T')[0],
        totalEarnings: Math.round(totalEarnings * 100) / 100,
        totalBills,
        averageBillValue: totalBills > 0 ? Math.round((totalEarnings / totalBills) * 100) / 100 : 0,
        paymentBreakdown,
        hourlyBreakdown,
        topItems
      },
      message: 'Today\'s summary retrieved successfully'
    });
  } catch (error) {
    console.error('Today summary error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch today\'s summary',
      error: error.message 
    });
  }
});

// Cancel bill (and restore stock)
router.patch('/:id/cancel', auth, async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id);
    
    if (!bill) {
      return res.status(404).json({ 
        success: false,
        message: 'Bill not found' 
      });
    }

    if (bill.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Bill is already cancelled'
      });
    }

    // Restore stock for cancelled bill
    for (const item of bill.items) {
      await MenuItem.findByIdAndUpdate(
        item.menuItem,
        { $inc: { stock: item.quantity } }
      );
    }

    bill.status = 'cancelled';
    bill.cancelledAt = new Date();
    bill.cancelledBy = req.user.userId;
    await bill.save();

    res.json({
      success: true,
      data: bill,
      message: 'Bill cancelled and stock restored'
    });
  } catch (error) {
    console.error('Cancel bill error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to cancel bill',
      error: error.message 
    });
  }
});

// Get bill statistics
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    let startDate, endDate = new Date();
    
    switch (period) {
      case 'today':
        startDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
        break;
      case 'week':
        startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(endDate.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
        endDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate
.getDate() + 1);
    }
    const bills = await Bill.find({
      createdAt: { $gte: startDate, $lt: endDate },
      status: 'paid'
    });
    const totalRevenue = bills.reduce((sum, bill) => sum + bill.total, 0);
    const totalBills = bills.length;
    const averageBill = totalBills > 0 ? totalRevenue / totalBills : 0;
    const paymentBreakdown = bills.reduce((acc, bill) => {
      acc[bill.paymentMethod] = (acc[bill.paymentMethod] || 0) + bill.total;
      return acc;
    }, {});
    const hourlyBreakdown = {};
    bills.forEach(bill => {
      const hour = new Date(bill.createdAt).getHours();
      hourlyBreakdown[hour] = (hourlyBreakdown[hour] || 0) + bill.total;
    });
    const topItems = bills.reduce((acc, bill) => {
      bill.items.forEach(item => {
        acc[item.name] = (acc[item.name] || 0) + item.quantity;
      });
      return acc;
    }, {});
    const sortedTopItems = Object.entries(topItems)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, quantity]) => ({ name, quantity }));
    res.json({
      success: true,
      data: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalBills,
        averageBill: Math.round(averageBill * 100) / 100,
        paymentBreakdown,
        hourlyBreakdown,
        topItems: sortedTopItems
      },
      message: `Statistics for ${period} period retrieved successfully`
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch bill statistics',
      error: error.message 
    });
  }
});
module.exports = router;