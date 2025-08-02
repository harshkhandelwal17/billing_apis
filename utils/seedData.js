
// utils/seedData.js - Initial Data Setup
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const MenuItem = require('../models/MenuItem');
const Employee = require('../models/Employee');

async function seedDatabase() {
  try {
    console.log('Seeding database...');
    
    // Create admin user
    const adminExists = await User.findOne({ role: 'admin' });
    if (!adminExists) {
      const admin = new User({
        username: 'admin',
        email: 'admin@restaurant.com',
        password: 'admin123',
        role: 'admin'
      });
      await admin.save();
      console.log('Admin user created');
    }
    
    // Create sample menu items
    const menuCount = await MenuItem.countDocuments();
    if (menuCount === 0) {
      const admin = await User.findOne({ role: 'admin' });
      
      const sampleMenu = [
        { name: 'Butter Chicken', price: 320, category: 'Main Course', stock: 25, createdBy: admin._id },
        { name: 'Paneer Tikka', price: 280, category: 'Starter', stock: 15, createdBy: admin._id },
        { name: 'Chicken Biryani', price: 350, category: 'Main Course', stock: 20, createdBy: admin._id },
        { name: 'Butter Naan', price: 45, category: 'Bread', stock: 50, createdBy: admin._id },
        { name: 'Gulab Jamun', price: 80, category: 'Dessert', stock: 30, createdBy: admin._id },
        { name: 'Dal Makhani', price: 220, category: 'Main Course', stock: 18, createdBy: admin._id },
        { name: 'Samosa', price: 25, category: 'Starter', stock: 40, createdBy: admin._id },
        { name: 'Mango Lassi', price: 60, category: 'Beverage', stock: 35, createdBy: admin._id }
      ];
      
      await MenuItem.insertMany(sampleMenu);
      console.log('Sample menu items created');
    }
    
    // Create sample employees
    const empCount = await Employee.countDocuments();
    if (empCount === 0) {
      const sampleEmployees = [
        { name: 'Rahul Kumar', email: 'rahul@restaurant.com', phone: '9876543210', role: 'waiter', salary: 18000 },
        { name: 'Priya Sharma', email: 'priya@restaurant.com', phone: '9876543211', role: 'cook', salary: 25000 },
        { name: 'Amit Singh', email: 'amit@restaurant.com', phone: '9876543212', role: 'cashier', salary: 20000 },
        { name: 'Sunita Devi', email: 'sunita@restaurant.com', phone: '9876543213', role: 'cleaner', salary: 12000 }
      ];
      
      await Employee.insertMany(sampleEmployees);
      console.log('Sample employees created');
    }
    
    console.log('Database seeding completed!');
  } catch (error) {
    console.error('Seeding error:', error);
  }
}
