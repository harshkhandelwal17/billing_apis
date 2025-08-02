const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const morgan = require('morgan');
// Import routes
const authRoutes = require('./routes/auth');
const menuRoutes = require('./routes/menu');
const billRoutes = require('./routes/bills');
const employeeRoutes = require('./routes/employees');
const analyticsRoutes = require('./routes/analytics');
const printerRoutes = require('./routes/printer');

// Load environment variables
dotenv.config();

const app = express();
app.use(morgan('dev')); // Logging middleware for development
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files for uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://harsh:harsh@unifiedcampus.i5fit.mongodb.net/billing_software1?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/printer', printerRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

