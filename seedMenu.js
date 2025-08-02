const mongoose = require('mongoose');
const MenuItem = require('./models/MenuItem');

// MongoDB connection
mongoose.connect('mongodb+srv://harsh:harsh@unifiedcampus.i5fit.mongodb.net/billing_software1?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection failed:', err);
    process.exit(1);
  });

const menuItems =[
  {
    "name": "Dal Fry",
    "price": 100,
    "category": "dal_special"
  },
  {
    "name": "Dal Tadka",
    "price": 120,
    "category": "dal_special"
  },
  {
    "name": "Dal Punjabi",
    "price": 130,
    "category": "dal_special"
  },
  {
    "name": "Jain Dal",
    "price": 100,
    "category": "dal_special"
  },
  {
    "name": "Dal Jeera",
    "price": 100,
    "category": "dal_special"
  },
  {
    "name": "Rice",
    "price": 90,
    "category": "rice"
  },
  {
    "name": "Jeera Rice",
    "price": 110,
    "category": "rice"
  },
  {
    "name": "Masala Rice",
    "price": 120,
    "category": "rice"
  },
  {
    "name": "Pulao",
    "price": 150,
    "category": "rice"
  },
  {
    "name": "Veg Biryani",
    "price": 150,
    "category": "rice"
  },
  {
    "name": "Butter Khichdi",
    "price": 140,
    "category": "rice"
  },
  {
    "name": "Butter Naan",
    "price": 50,
    "category": "tandoori_roti"
  },
  {
    "name": "Tandoori Roti",
    "price": 12,
    "category": "tandoori_roti"
  },
  {
    "name": "Tandoori Roti Butter",
    "price": 15,
    "category": "tandoori_roti"
  },
  {
    "name": "Tawa Roti",
    "price": 10,
    "category": "tandoori_roti"
  },
  {
    "name": "Tawa Roti Butter",
    "price": 12,
    "category": "tandoori_roti"
  },
  {
    "name": "Tawa Paratha",
    "price": 15,
    "category": "tandoori_roti"
  },
  {
    "name": "Garlic Naan",
    "price": 60,
    "category": "tandoori_roti"
  },
  {
    "name": "Cheese Garlic Naan",
    "price": 70,
    "category": "tandoori_roti"
  },
  {
    "name": "Lachha Paratha",
    "price": 50,
    "category": "tandoori_roti"
  },
  {
    "name": "Green Salad",
    "price": 40,
    "category": "papad_salad"
  },
  {
    "name": "Plain Papad",
    "price": 20,
    "category": "papad_salad"
  },
  {
    "name": "Masala Papad",
    "price": 30,
    "category": "papad_salad"
  }
]

// Use your actual User ID
const createdBy = "64d4be8f2f9f1a6b3e1c1234";

const seed = async () => {
  try {
    const formatted = menuItems.map(item => ({
      ...item,
      category: "starter",
      createdBy
    }));

    const result = await MenuItem.insertMany(formatted);
    console.log(`${result.length} items inserted successfully!`);
  } catch (error) {
    console.error("Error inserting menu items:", error);
  } finally {
    mongoose.connection.close();
  }
};

seed();
