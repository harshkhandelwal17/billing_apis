
const express = require('express');
const MenuItem = require('../models/MenuItem');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const { upload, deleteFromCloudinary, cloudinary } = require('../config/cloudinary');
const mongoose = require('mongoose');

const router = express.Router();

// Get all menu items with advanced filtering and pagination
router.get('/', async (req, res) => {
  try {
    const {
      category,
      search,
      available,
      popular,
      minPrice,
      maxPrice,
      allergens,
      vegan,
      vegetarian,
      glutenFree,
      spiceLevel,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 50
    } = req.query;
    
    let query = { isDeleted: { $ne: true } };
    
    // Filtering
    if (category && category !== 'all') {
      query.category = category;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }
    
    if (available !== undefined) {
      query.isAvailable = available === 'true';
    }
    
    if (popular === 'true') {
      query.isPopular = true;
    }
    
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }
    
    if (allergens) {
      const allergenArray = allergens.split(',');
      query.allergens = { $nin: allergenArray };
    }
    
    if (vegan === 'true') query.isVegan = true;
    if (vegetarian === 'true') query.isVegetarian = true;
    if (glutenFree === 'true') query.isGlutenFree = true;
    if (spiceLevel) query.spiceLevel = spiceLevel;

    // Sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [menuItems, totalCount] = await Promise.all([
      MenuItem.find(query)
        .populate('createdBy', 'username email')
        .populate('updatedBy', 'username')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      MenuItem.countDocuments(query)
    ]);

    // Calculate statistics
    const stats = {
      total: totalCount,
      available: await MenuItem.countDocuments({ ...query, isAvailable: true }),
      outOfStock: await MenuItem.countDocuments({ ...query, stock: 0 }),
      lowStock: await MenuItem.countDocuments({ ...query, stock: { $gt: 0, $lte: 5 } }),
      popular: await MenuItem.countDocuments({ ...query, isPopular: true })
    };

    res.json({
      success: true,
      data: menuItems,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalItems: totalCount,
        itemsPerPage: parseInt(limit),
        hasNext: skip + parseInt(limit) < totalCount,
        hasPrev: parseInt(page) > 1
      },
      stats
    });
  } catch (error) {
    console.error('Get menu items error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch menu items',
      error: error.message 
    });
  }
});

// Get menu categories and their counts
router.get('/categories', async (req, res) => {
  try {
    const categories = await MenuItem.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { 
        $group: { 
          _id: '$category', 
          count: { $sum: 1 },
          availableCount: { 
            $sum: { $cond: [{ $eq: ['$isAvailable', true] }, 1, 0] } 
          },
          avgPrice: { $avg: '$price' }
        } 
      },
      { $sort: { count: -1 } }
    ]);

    const categoryData = MenuItem.getCategories().map(cat => {
      const found = categories.find(c => c._id === cat);
      return {
        value: cat,
        label: cat.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        count: found ? found.count : 0,
        availableCount: found ? found.availableCount : 0,
        avgPrice: found ? Math.round(found.avgPrice * 100) / 100 : 0
      };
    });

    res.json({
      success: true,
      data: categoryData
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch categories',
      error: error.message 
    });
  }
});

// Get menu statistics
router.get('/stats', async (req, res) => {
  try {
    const [
      totalItems,
      availableItems,
      outOfStockItems,
      lowStockItems,
      popularItems,
      avgPrice,
      totalRevenue,
      topRatedItems
    ] = await Promise.all([
      MenuItem.countDocuments({ isDeleted: { $ne: true } }),
      MenuItem.countDocuments({ isDeleted: { $ne: true }, isAvailable: true }),
      MenuItem.countDocuments({ isDeleted: { $ne: true }, stock: 0 }),
      MenuItem.countDocuments({ isDeleted: { $ne: true }, stock: { $gt: 0, $lte: 5 } }),
      MenuItem.countDocuments({ isDeleted: { $ne: true }, isPopular: true }),
      MenuItem.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        { $group: { _id: null, avgPrice: { $avg: '$price' } } }
      ]),
      MenuItem.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        { $group: { _id: null, totalRevenue: { $sum: { $multiply: ['$price', '$totalOrders'] } } } }
      ]),
      MenuItem.find({ 
        isDeleted: { $ne: true }, 
        averageRating: { $gte: 4 } 
      }).limit(5).sort({ averageRating: -1, totalReviews: -1 })
    ]);

    res.json({
      success: true,
      data: {
        totalItems,
        availableItems,
        outOfStockItems,
        lowStockItems,
        popularItems,
        avgPrice: avgPrice[0]?.avgPrice || 0,
        totalRevenue: totalRevenue[0]?.totalRevenue || 0,
        topRatedItems
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch statistics',
      error: error.message 
    });
  }
});

// Get single menu item
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid menu item ID' 
      });
    }

    const menuItem = await MenuItem.findOne({
      _id: req.params.id,
      isDeleted: { $ne: true }
    })
    .populate('createdBy', 'username email')
    .populate('updatedBy', 'username')
    .populate('reviews.customer', 'username');
    
    if (!menuItem) {
      return res.status(404).json({ 
        success: false, 
        message: 'Menu item not found' 
      });
    }

    res.json({
      success: true,
      data: menuItem
    });
  } catch (error) {
    console.error('Get menu item error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch menu item',
      error: error.message 
    });
  }
});

// Create menu item (Admin only)
router.post('/', auth, adminAuth, upload.single('image'), async (req, res) => {
  try {
    const { 
      name, description, price, cost, category, stock, 
      isAvailable, isPopular, preparationTime, allergens,
      isVegan, isVegetarian, isGlutenFree, isDairyFree,
      spiceLevel, portionSize, tags
    } = req.body;
    
    // Validate required fields
    if (!name || !price || !category) {
      return res.status(400).json({
        success: false,
        message: 'Name, price, and category are required'
      });
    }

    const menuItemData = {
      name: name.trim(),
      description: description?.trim(),
      price: parseFloat(price),
      cost: cost ? parseFloat(cost) : 0,
      category: category.toLowerCase(),
      stock: parseInt(stock) || 0,
      isAvailable: isAvailable === 'true' || isAvailable === true,
      isPopular: isPopular === 'true' || isPopular === true,
      preparationTime: preparationTime ? parseInt(preparationTime) : 0,
      allergens: allergens ? (Array.isArray(allergens) ? allergens : allergens.split(',')) : [],
      isVegan: isVegan === 'true' || isVegan === true,
      isVegetarian: isVegetarian === 'true' || isVegetarian === true,
      isGlutenFree: isGlutenFree === 'true' || isGlutenFree === true,
      isDairyFree: isDairyFree === 'true' || isDairyFree === true,
      spiceLevel: spiceLevel || 'mild',
      portionSize: portionSize || 'medium',
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [],
      createdBy: req.user.userId
    };

    // Add Cloudinary image data if uploaded
    if (req.file) {
      menuItemData.image = {
        url: req.file.path,
        publicId: req.file.filename,
        width: req.file.width,
        height: req.file.height
      };
    }

    const menuItem = new MenuItem(menuItemData);
    await menuItem.save();
    await menuItem.populate('createdBy', 'username email');

    res.status(201).json({
      success: true,
      message: 'Menu item created successfully',
      data: menuItem
    });
  } catch (error) {
    console.error('Create menu item error:', error);
    
    // Delete uploaded image if menu item creation fails
    if (req.file?.filename) {
      await deleteFromCloudinary(req.file.filename);
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create menu item',
      error: error.message 
    });
  }
});

// Update menu item (Admin only)
router.put('/:id', auth, adminAuth, upload.single('image'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid menu item ID' 
      });
    }

    const existingItem = await MenuItem.findOne({
      _id: req.params.id,
      isDeleted: { $ne: true }
    });

    if (!existingItem) {
      return res.status(404).json({ 
        success: false, 
        message: 'Menu item not found' 
      });
    }

    const { 
      name, description, price, cost, category, stock, 
      isAvailable, isPopular, preparationTime, allergens,
      isVegan, isVegetarian, isGlutenFree, isDairyFree,
      spiceLevel, portionSize, tags
    } = req.body;
    
    const updateData = {
      name: name?.trim(),
      description: description?.trim(),
      price: price ? parseFloat(price) : existingItem.price,
      cost: cost ? parseFloat(cost) : existingItem.cost,
      category: category ? category.toLowerCase() : existingItem.category,
      stock: stock !== undefined ? parseInt(stock) : existingItem.stock,
      isAvailable: isAvailable !== undefined ? (isAvailable === 'true' || isAvailable === true) : existingItem.isAvailable,
      isPopular: isPopular !== undefined ? (isPopular === 'true' || isPopular === true) : existingItem.isPopular,
      preparationTime: preparationTime ? parseInt(preparationTime) : existingItem.preparationTime,
      allergens: allergens ? (Array.isArray(allergens) ? allergens : allergens.split(',')) : existingItem.allergens,
      isVegan: isVegan !== undefined ? (isVegan === 'true' || isVegan === true) : existingItem.isVegan,
      isVegetarian: isVegetarian !== undefined ? (isVegetarian === 'true' || isVegetarian === true) : existingItem.isVegetarian,
      isGlutenFree: isGlutenFree !== undefined ? (isGlutenFree === 'true' || isGlutenFree === true) : existingItem.isGlutenFree,
      isDairyFree: isDairyFree !== undefined ? (isDairyFree === 'true' || isDairyFree === true) : existingItem.isDairyFree,
      spiceLevel: spiceLevel || existingItem.spiceLevel,
      portionSize: portionSize || existingItem.portionSize,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : existingItem.tags,
      updatedBy: req.user.userId
    };

    // Handle image update
    if (req.file) {
      // Delete old image from Cloudinary
      if (existingItem.image?.publicId) {
        await deleteFromCloudinary(existingItem.image.publicId);
      }
      
      // Add new image data
      updateData.image = {
        url: req.file.path,
        publicId: req.file.filename,
        width: req.file.width,
        height: req.file.height
      };
    }

    const menuItem = await MenuItem.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
    .populate('createdBy', 'username email')
    .populate('updatedBy', 'username');

    res.json({
      success: true,
      message: 'Menu item updated successfully',
      data: menuItem
    });
  } catch (error) {
    console.error('Update menu item error:', error);
    
    // Delete uploaded image if update fails
    if (req.file?.filename) {
      await deleteFromCloudinary(req.file.filename);
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update menu item',
      error: error.message 
    });
  }
});

// Soft delete menu item (Admin only)
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid menu item ID' 
      });
    }

    const menuItem = await MenuItem.findOne({
      _id: req.params.id,
      isDeleted: { $ne: true }
    });
    
    if (!menuItem) {
      return res.status(404).json({ 
        success: false, 
        message: 'Menu item not found' 
      });
    }

    // Soft delete
    menuItem.isDeleted = true;
    menuItem.deletedAt = new Date();
    menuItem.deletedBy = req.user.userId;
    await menuItem.save();

    res.json({ 
      success: true, 
      message: 'Menu item deleted successfully' 
    });
  } catch (error) {
    console.error('Delete menu item error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete menu item',
      error: error.message 
    });
  }
});

// Permanent delete menu item (Admin only)
router.delete('/:id/permanent', auth, adminAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid menu item ID' 
      });
    }

    const menuItem = await MenuItem.findById(req.params.id);
    
    if (!menuItem) {
      return res.status(404).json({ 
        success: false, 
        message: 'Menu item not found' 
      });
    }

    // Delete images from Cloudinary
    if (menuItem.image?.publicId) {
      await deleteFromCloudinary(menuItem.image.publicId);
    }
    
    if (menuItem.images?.length > 0) {
      for (const img of menuItem.images) {
        if (img.publicId) {
          await deleteFromCloudinary(img.publicId);
        }
      }
    }

    // Permanently delete from database
    await MenuItem.findByIdAndDelete(req.params.id);

    res.json({ 
      success: true, 
      message: 'Menu item permanently deleted' 
    });
  } catch (error) {
    console.error('Permanent delete error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to permanently delete menu item',
      error: error.message 
    });
  }
});

// Restore deleted menu item (Admin only)
router.patch('/:id/restore', auth, adminAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid menu item ID' 
      });
    }

    const menuItem = await MenuItem.findByIdAndUpdate(
      req.params.id,
      { 
        isDeleted: false,
        $unset: { deletedAt: 1, deletedBy: 1 }
      },
      { new: true }
    );

    if (!menuItem) {
      return res.status(404).json({ 
        success: false, 
        message: 'Menu item not found' 
      });
    }

    res.json({
      success: true,
      message: 'Menu item restored successfully',
      data: menuItem
    });
  } catch (error) {
    console.error('Restore menu item error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to restore menu item',
      error: error.message 
    });
  }
});

// Update stock
router.patch('/:id/stock', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid menu item ID' 
      });
    }

    const { stock } = req.body;
    
    if (stock === undefined || stock < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid stock quantity is required'
      });
    }
    
    const menuItem = await MenuItem.findOneAndUpdate(
      { _id: req.params.id, isDeleted: { $ne: true } },
      { 
        stock: parseInt(stock),
        updatedBy: req.user.userId 
      },
      { new: true }
    );

    if (!menuItem) {
      return res.status(404).json({ 
        success: false, 
        message: 'Menu item not found' 
      });
    }

    res.json({
      success: true,
      message: 'Stock updated successfully',
      data: menuItem
    });
  } catch (error) {
    console.error('Update stock error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update stock',
      error: error.message 
    });
  }
});

// Toggle availability
router.patch('/:id/availability', auth, adminAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid menu item ID' 
      });
    }

    const menuItem = await MenuItem.findOne({
      _id: req.params.id,
      isDeleted: { $ne: true }
    });

    if (!menuItem) {
      return res.status(404).json({ 
        success: false, 
        message: 'Menu item not found' 
      });
    }

    menuItem.isAvailable = !menuItem.isAvailable;
    menuItem.updatedBy = req.user.userId;
    await menuItem.save();

    res.json({
      success: true,
      message: `Menu item ${menuItem.isAvailable ? 'enabled' : 'disabled'} successfully`,
      data: menuItem
    });
  } catch (error) {
    console.error('Toggle availability error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to toggle availability',
      error: error.message 
    });
  }
});

// Toggle popular status
router.patch('/:id/popular', auth, adminAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid menu item ID' 
      });
    }

    const menuItem = await MenuItem.findOne({
      _id: req.params.id,
      isDeleted: { $ne: true }
    });

    if (!menuItem) {
      return res.status(404).json({ 
        success: false, 
        message: 'Menu item not found' 
      });
    }

    menuItem.isPopular = !menuItem.isPopular;
    menuItem.updatedBy = req.user.userId;
    await menuItem.save();

    res.json({
      success: true,
      message: `Menu item ${menuItem.isPopular ? 'marked as popular' : 'removed from popular'}`,
      data: menuItem
    });
  } catch (error) {
    console.error('Toggle popular error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to toggle popular status',
      error: error.message 
    });
  }
});

// Add review to menu item
router.post('/:id/reviews', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid menu item ID' 
      });
    }

    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const menuItem = await MenuItem.findOne({
      _id: req.params.id,
      isDeleted: { $ne: true }
    });

    if (!menuItem) {
      return res.status(404).json({ 
        success: false, 
        message: 'Menu item not found' 
      });
    }

    // Check if user already reviewed this item
    const existingReview = menuItem.reviews.find(
      review => review.customer.toString() === req.user.userId
    );

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this item'
      });
    }

    // Add new review
    menuItem.reviews.push({
      rating: parseInt(rating),
      comment: comment?.trim(),
      customer: req.user.userId
    });

    await menuItem.save();
    await menuItem.populate('reviews.customer', 'username');

    res.status(201).json({
      success: true,
      message: 'Review added successfully',
      data: menuItem
    });
  } catch (error) {
    console.error('Add review error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to add review',
      error: error.message 
    });
  }
});

// Bulk operations
router.post('/bulk/update', auth, adminAuth, async (req, res) => {
  try {
    const { ids, action, data } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid item IDs array is required'
      });
    }

    // Validate all IDs
    const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length !== ids.length) {
      return res.status(400).json({
        success: false,
        message: 'Some item IDs are invalid'
      });
    }

    let updateData = { updatedBy: req.user.userId };
    let message = '';

    switch (action) {
      case 'enable':
        updateData.isAvailable = true;
        message = 'Items enabled successfully';
        break;
      case 'disable':
        updateData.isAvailable = false;
        message = 'Items disabled successfully';
        break;
      case 'mark-popular':
        updateData.isPopular = true;
        message = 'Items marked as popular';
        break;
      case 'unmark-popular':
        updateData.isPopular = false;
        message = 'Items removed from popular';
        break;
      case 'update-category':
        if (!data?.category) {
          return res.status(400).json({
            success: false,
            message: 'Category is required for category update'
          });
        }
        updateData.category = data.category.toLowerCase();
        message = 'Category updated successfully';
        break;
      case 'soft-delete':
        updateData.isDeleted = true;
        updateData.deletedAt = new Date();
        updateData.deletedBy = req.user.userId;
        message = 'Items deleted successfully';
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid action specified'
        });
    }

    const result = await MenuItem.updateMany(
      { 
        _id: { $in: validIds },
        isDeleted: { $ne: true }
      },
      updateData
    );

    res.json({
      success: true,
      message,
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount
      }
    });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to perform bulk operation',
      error: error.message 
    });
  }
});

// Search suggestions
router.get('/search/suggestions', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.json({
        success: true,
        data: []
      });
    }

    const suggestions = await MenuItem.aggregate([
      {
        $match: {
          isDeleted: { $ne: true },
          isAvailable: true,
          $or: [
            { name: { $regex: q, $options: 'i' } },
            { tags: { $in: [new RegExp(q, 'i')] } }
          ]
        }
      },
      {
        $project: {
          name: 1,
          category: 1,
          price: 1,
          image: 1
        }
      },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      data: suggestions
    });
  } catch (error) {
    console.error('Search suggestions error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch suggestions',
      error: error.message 
    });
  }
});

// Export menu data
router.get('/export/csv', auth, adminAuth, async (req, res) => {
  try {
    const menuItems = await MenuItem.find({ isDeleted: { $ne: true } })
      .select('name description price cost category stock isAvailable isPopular preparationTime allergens averageRating totalOrders createdAt')
      .sort({ createdAt: -1 });

    // Convert to CSV format
    const csvHeaders = [
      'Name', 'Description', 'Price', 'Cost', 'Profit', 'Category', 
      'Stock', 'Available', 'Popular', 'Prep Time', 'Allergens', 
      'Rating', 'Total Orders', 'Created At'
    ];

    const csvData = menuItems.map(item => [
      item.name,
      item.description || '',
      item.price,
      item.cost,
      item.price - item.cost,
      item.category,
      item.stock,
      item.isAvailable ? 'Yes' : 'No',
      item.isPopular ? 'Yes' : 'No',
      item.preparationTime,
      item.allergens.join('; '),
      item.averageRating,
      item.totalOrders,
      item.createdAt.toISOString().split('T')[0]
    ]);

    const csv = [csvHeaders, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=menu-items.csv');
    res.send(csv);
  } catch (error) {
    console.error('Export CSV error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to export menu data',
      error: error.message 
    });
  }
});

module.exports = router;
