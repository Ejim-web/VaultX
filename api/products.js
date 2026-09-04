// api/products.js
const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SDK_JSON);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}
const db = admin.firestore();

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // GET – fetch all products
    if (req.method === 'GET') {
      const snapshot = await db.collection('products')
        .orderBy('timestamp', 'desc')
        .get();
      
      if (snapshot.empty) {
        return res.status(200).json({ success: true, products: [] });
      }
      
      const products = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      return res.status(200).json({ success: true, products });
    }

    // POST – create new product
    if (req.method === 'POST') {
      const {
        title, description, price, category, condition, location,
        images, quantity, deliveryOptions, sellerId, sellerEmail, sellerName
      } = req.body;

      // Validate
      if (!title || !price || !category || !sellerId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: title, price, category, sellerId'
        });
      }

      const product = {
        title: title.trim(),
        description: (description || '').trim(),
        price: parseFloat(price),
        category: category.trim(),
        condition: condition || 'New',
        location: location || '',
        images: Array.isArray(images) ? images : [],
        quantity: parseInt(quantity) || 1,
        deliveryOptions: deliveryOptions || '',
        sellerId,
        sellerEmail: sellerEmail || '',
        sellerName: sellerName || sellerEmail || 'VaultX Seller',
        verified: false,
        rating: 0,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        status: 'active'
      };

      const docRef = await db.collection('products').add(product);
      const newProduct = {
        id: docRef.id,
        ...product,
        timestamp: new Date().toISOString()
      };

      return res.status(201).json({ success: true, product: newProduct });
    }

    // Method not allowed
    return res.status(405).json({ success: false, error: 'Method not allowed' });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
};
