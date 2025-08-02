// const mongoose = require('mongoose');

// const menuItemSchema = new mongoose.Schema({
//   name: {
//     type: String,
//     required: true,
//     trim: true
//   },
//   description: {
//     type: String,
//     trim: true
//   },
//   price: {
//     type: Number,
//     required: true,
//     min: 0
//   },
//   category: {
//     type: String,
//     required: true,
//     enum: ['Starter', 'Main Course', 'Dessert', 'Beverage', 'Bread', 'Other']
//   },
//   image: {
//     type: String,
//     default: null
//   },
//   stock: {
//     type: Number,
//     default: 0,
//     min: 0
//   },
//   isAvailable: {
//     type: Boolean,
//     default: true
//   },
//   createdBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   }
// }, {
//   timestamps: true
// });

// module.exports = mongoose.model('MenuItem', menuItemSchema);




// models/MenuItem.js - Enhanced Menu Item Model
const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Item name is required'],
    trim: true,
    maxlength: [100, 'Item name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative'],
    validate: {
      validator: function(v) {
        return v > 0;
      },
      message: 'Price must be greater than 0'
    }
  },
  cost: {
    type: Number,
    default: 0,
    min: [0, 'Cost cannot be negative']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: {
      values: ['starter', 'main-course', 'dessert', 'breakfast', 'beverage', 'bread', 'rice', 'curry', 'other'],
      message: '{VALUE} is not a valid category'
    },
    lowercase: true
  },
  // Cloudinary image URLs
  image: {
    url: String,
    publicId: String,
    width: Number,
    height: Number
  },
  images: [{
    url: String,
    publicId: String,
    width: Number,
    height: Number,
    alt: String,
    isPrimary: { type: Boolean, default: false }
  }],
  stock: {
    type: Number,
    default: 0,
    min: [0, 'Stock cannot be negative']
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  preparationTime: {
    type: Number,
    default: 0,
    min: [0, 'Preparation time cannot be negative'],
    max: [180, 'Preparation time cannot exceed 180 minutes']
  },
  allergens: [{
    type: String,
    enum: ['Dairy', 'Nuts', 'Gluten', 'Soy', 'Eggs', 'Seafood', 'Shellfish', 'Sesame']
  }],
  nutritionalInfo: {
    calories: { type: Number, min: 0 },
    protein: { type: Number, min: 0 },
    carbs: { type: Number, min: 0 },
    fat: { type: Number, min: 0 },
    fiber: { type: Number, min: 0 }
  },
  tags: [String],
  spiceLevel: {
    type: String,
    enum: ['mild', 'medium', 'hot', 'extra-hot'],
    default: 'mild'
  },
  portionSize: {
    type: String,
    enum: ['small', 'medium', 'large'],
    default: 'medium'
  },
  isVegan: { type: Boolean, default: false },
  isVegetarian: { type: Boolean, default: false },
  isGlutenFree: { type: Boolean, default: false },
  isDairyFree: { type: Boolean, default: false },
  reviews: [{
    rating: { type: Number, min: 1, max: 5 },
    comment: String,
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
  }],
  averageRating: { type: Number, default: 0, min: 0, max: 5 },
  totalReviews: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 },
  lastOrderedAt: Date,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isDeleted: { type: Boolean, default: false },
  deletedAt: Date,
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for profit calculation
menuItemSchema.virtual('profit').get(function() {
  return this.price - this.cost;
});

// Virtual for profit percentage
menuItemSchema.virtual('profitPercentage').get(function() {
  if (this.price === 0) return 0;
  return ((this.price - this.cost) / this.price) * 100;
});

// Virtual for optimized image URLs
menuItemSchema.virtual('optimizedImage').get(function() {
  if (!this.image?.url) return null;
  return {
    thumbnail: this.image.url.replace('/upload/', '/upload/w_200,h_150,c_fill,q_auto/'),
    medium: this.image.url.replace('/upload/', '/upload/w_400,h_300,c_fill,q_auto/'),
    large: this.image.url.replace('/upload/', '/upload/w_800,h_600,c_fill,q_auto/'),
    original: this.image.url
  };
});

// Index for better query performance
menuItemSchema.index({ category: 1, isAvailable: 1 });
menuItemSchema.index({ name: 'text', description: 'text' });
menuItemSchema.index({ isPopular: -1, createdAt: -1 });
menuItemSchema.index({ averageRating: -1 });

// Pre-save middleware to update averageRating
menuItemSchema.pre('save', function(next) {
  if (this.reviews && this.reviews.length > 0) {
    const totalRating = this.reviews.reduce((sum, review) => sum + review.rating, 0);
    this.averageRating = totalRating / this.reviews.length;
    this.totalReviews = this.reviews.length;
  }
  next();
});

// Static method to get categories
menuItemSchema.statics.getCategories = function() {
  return ['starter', 'main-course', 'breakfast', 'dessert', 'beverage', 'bread', 'rice', 'curry', 'other'];
};

// Instance method to check if item is low stock
menuItemSchema.methods.isLowStock = function() {
  return this.stock <= 5 && this.stock > 0;
};

// Instance method to check if item is out of stock
menuItemSchema.methods.isOutOfStock = function() {
  return this.stock === 0;
};

module.exports = mongoose.model('MenuItem', menuItemSchema);