const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dcha7gy9o',
  api_key: process.env.CLOUDINARY_API_KEY || '926234579185835',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'k-MDaLM8HN1PL2df0RrTrFcME3Q',
});
// Configure Cloudinary storage for multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'restaurant-menu',
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [
      { width: 1200, height: 900, crop: 'limit', quality: 'auto' },
    ],
    public_id: (req, file) => {
      // Generate unique filename
      const timestamp = Date.now();
      const random = Math.round(Math.random() * 1E9);
      return `menu-item-${timestamp}-${random}`;
    },
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5 // Maximum 5 files
  },
  fileFilter: (req, file, cb) => {
    // Check if file is an image
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Helper function to delete image from Cloudinary
const deleteFromCloudinary = async (publicId) => {
  try {
    if (publicId) {
      await cloudinary.uploader.destroy(publicId);
      console.log(`Deleted image with public_id: ${publicId}`);
    }
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
  }
};

module.exports = {
  cloudinary,
  upload,
  deleteFromCloudinary
};
