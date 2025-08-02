const express = require('express');
const Bill = require('../models/Bill');
const MenuItem = require('../models/MenuItem');
const Employee = require('../models/Employee');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();

// Daily earnings report
router.get('/daily-earnings', auth, async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    
    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1);

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

    const hourlyBreakdown = {};
    bills.forEach(bill => {
      const hour = new Date(bill.createdAt).getHours();
      hourlyBreakdown[hour] = (hourlyBreakdown[hour] || 0) + bill.total;
    });

    res.json({
      date: targetDate.toISOString().split('T')[0],
      totalEarnings,
      totalBills,
      averageBillValue: totalBills > 0 ? Math.round((totalEarnings / totalBills) * 100) / 100 : 0,
      paymentBreakdown,
      hourlyBreakdown
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Top selling items
router.get('/top-selling', auth, async (req, res) => {
  try {
    const { period = 'today', limit = 10 } = req.query;
    
    let startDate, endDate;
    const now = new Date();
    
    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        endDate = new Date();
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    }

    const bills = await Bill.find({
      createdAt: { $gte: startDate, $lt: endDate },
      status: 'paid'
    });

    const itemSales = {};
    
    bills.forEach(bill => {
      bill.items.forEach(item => {
        if (itemSales[item.name]) {
          itemSales[item.name].quantity += item.quantity;
          itemSales[item.name].totalRevenue += item.total;
          itemSales[item.name].orders += 1;
        } else {
          itemSales[item.name] = {
            name: item.name,
            quantity: item.quantity,
            totalRevenue: item.total,
            orders: 1,
            price: item.price
          };
        }
      });
    });

    const topItems = Object.values(itemSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, parseInt(limit));

    res.json({
      period,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      topSellingItems: topItems
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Sales trends
router.get('/sales-trends', auth, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - parseInt(days));

    const dailySales = [];
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      
      const dayBills = await Bill.find({
        createdAt: { $gte: dayStart, $lt: dayEnd },
        status: 'paid'
      });
      
      const dayEarnings = dayBills.reduce((sum, bill) => sum + bill.total, 0);
      const dayOrders = dayBills.length;
      
      dailySales.push({
        date: dayStart.toISOString().split('T')[0],
        earnings: dayEarnings,
        orders: dayOrders,
        averageOrderValue: dayOrders > 0 ? Math.round((dayEarnings / dayOrders) * 100) / 100 : 0
      });
    }

    res.json({
      period: `${days} days`,
      dailySales
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Monthly report
router.get('/monthly-report', auth, adminAuth, async (req, res) => {
  try {
    const { month, year } = req.query;
    const targetMonth = month ? parseInt(month) - 1 : new Date().getMonth();
    const targetYear = year ? parseInt(year) : new Date().getFullYear();
    
    const startDate = new Date(targetYear, targetMonth, 1);
    const endDate = new Date(targetYear, targetMonth + 1, 1);

    // Sales data
    const bills = await Bill.find({
      createdAt: { $gte: startDate, $lt: endDate },
      status: 'paid'
    });

    const totalRevenue = bills.reduce((sum, bill) => sum + bill.total, 0);
    const totalOrders = bills.length;
    
    // Employee data
    const employees = await Employee.find({ isActive: true });
    const totalSalaryExpense = employees.reduce((sum, emp) => {
      const monthAttendance = emp.attendance.filter(att => {
        const attDate = new Date(att.date);
        return attDate.getMonth() === targetMonth && attDate.getFullYear() === targetYear;
      });
      
      const presentDays = monthAttendance.filter(att => att.isPresent).length;
      const workingDays = new Date(targetYear, targetMonth + 1, 0).getDate();
      const earnedSalary = (emp.salary / workingDays) * presentDays;
      
      return sum + earnedSalary;
    }, 0);

    // Top items
    const itemSales = {};
    bills.forEach(bill => {
      bill.items.forEach(item => {
        if (itemSales[item.name]) {
          itemSales[item.name].quantity += item.quantity;
          itemSales[item.name].revenue += item.total;
        } else {
          itemSales[item.name] = {
            name: item.name,
            quantity: item.quantity,
            revenue: item.total
          };
        }
      });
    });

    const topItems = Object.values(itemSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    res.json({
      period: `${targetMonth + 1}/${targetYear}`,
      summary: {
        totalRevenue,
        totalOrders,
        averageOrderValue: totalOrders > 0 ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0,
        totalSalaryExpense: Math.round(totalSalaryExpense),
        netProfit: Math.round(totalRevenue - totalSalaryExpense)
      },
      topSellingItems: topItems,
      totalEmployees: employees.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Dashboard summary
router.get('/dashboard', auth, async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    // Today's sales
    const todayBills = await Bill.find({
      createdAt: { $gte: startOfDay, $lt: endOfDay },
      status: 'paid'
    });
    
    const todayEarnings = todayBills.reduce((sum, bill) => sum + bill.total, 0);
    
    // This month's sales
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthBills = await Bill.find({
      createdAt: { $gte: startOfMonth },
      status: 'paid'
    });
    
    const monthEarnings = monthBills.reduce((sum, bill) => sum + bill.total, 0);
    
    // Employee attendance today
    const employees = await Employee.find({ isActive: true });
    const todayString = today.toISOString().split('T')[0];
    
    const presentToday = employees.filter(emp => {
      const todayAttendance = emp.attendance.find(
        att => att.date.toISOString().split('T')[0] === todayString
      );
      return todayAttendance?.isPresent;
    }).length;
    
    // Low stock items
    const lowStockItems = await MenuItem.find({
      stock: { $lt: 10 },
      isAvailable: true
    }).select('name stock category');
    
    // Recent orders
    const recentOrders = await Bill.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('billNumber customerName total createdAt status');

    res.json({
      todayStats: {
        earnings: todayEarnings,
        orders: todayBills.length,
        averageOrder: todayBills.length > 0 ? Math.round((todayEarnings / todayBills.length) * 100) / 100 : 0
      },
      monthStats: {
        earnings: monthEarnings,
        orders: monthBills.length
      },
      employeeStats: {
        present: presentToday,
        total: employees.length,
        absent: employees.length - presentToday
      },
      alerts: {
        lowStockItems: lowStockItems.length,
        lowStockDetails: lowStockItems
      },
      recentOrders
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
