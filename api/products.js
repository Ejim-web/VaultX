// api/products.js – VaultX API (Firestore)
const admin = require('firebase-admin');

// Initialize Firebase Admin
let db;
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SDK_JSON);
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  }
  db = admin.firestore();
  console.log('✅ Firebase Admin initialized');
} catch (err) {
  console.error('❌ Firebase init error:', err.message);
  // Continue without Firebase – we'll handle fallback later.
}

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET – from Firestore
    if (req.method === 'GET') {
      if (!db) {
        // Fallback static products
        return res.status(200).json({
          success: true,
          products: [
            { id: '1', title: 'Sample Product 1', price: 10000, category: 'Other', condition: 'New', location: 'Global', images: [], sellerName: 'VaultX', verified: true, rating: 5 }
          ]
        });
      }

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

    // POST – save to Firestore
    if (req.method === 'POST') {
      if (!db) {
        return res.status(503).json({
          success: false,
          error: 'Firestore not available – check FIREBASE_ADMIN_SDK_JSON'
        });
      }

      const {
        title, description, price, category, condition, location,
        images, quantity, deliveryOptions, sellerId, sellerEmail, sellerName
      } = req.body;

      // Validate required fields
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

    return res.status(405).json({ success: false, error: 'Method not allowed' });

  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
};
