// api/products.js – Diagnostic Version
const admin = require('firebase-admin');

let db = null;
let firebaseError = null;

// Check environment variable
const envJson = process.env.FIREBASE_ADMIN_SDK_JSON;
if (!envJson) {
  firebaseError = 'FIREBASE_ADMIN_SDK_JSON not set in environment.';
  console.error('❌', firebaseError);
} else {
  try {
    const serviceAccount = JSON.parse(envJson);
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id,
      });
    }
    db = admin.firestore();
    console.log('✅ Firebase Admin initialized');
  } catch (err) {
    firebaseError = 'Firebase init error: ' + err.message;
    console.error('❌', firebaseError);
  }
}

// Static fallback products (always available)
const FALLBACK_PRODUCTS = [
  {
    id: 'fallback1',
    title: 'Vintage Rolex Submariner',
    description: 'Classic 16610 with box and papers.',
    price: 250000,
    category: 'Jewelry & Watches',
    condition: 'Excellent',
    location: 'Lagos, Nigeria',
    images: ['https://images.unsplash.com/photo-1533139502658-0198f920d8e8?w=400&h=300&fit=crop'],
    sellerName: 'Luxury Watches',
    verified: true,
    rating: 4.9
  },
  {
    id: 'fallback2',
    title: 'Hermès Birkin 30',
    description: 'Himalayan crocodile, white gold hardware.',
    price: 450000,
    category: 'Fashion',
    condition: 'Like New',
    location: 'Abuja, Nigeria',
    images: ['https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=400&h=300&fit=crop'],
    sellerName: 'Luxury Bags',
    verified: true,
    rating: 5.0
  }
];

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET – return Firestore products if available, else fallback
    if (req.method === 'GET') {
      if (db) {
        const snapshot = await db.collection('products')
          .orderBy('timestamp', 'desc')
          .get();
        if (!snapshot.empty) {
          const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          return res.status(200).json({ 
            success: true, 
            products,
            firebase_status: 'connected'
          });
        }
        return res.status(200).json({ 
          success: true, 
          products: [],
          firebase_status: 'connected_empty'
        });
      } else {
        // Firebase not available – return fallback + error info
        return res.status(200).json({
          success: true,
          products: FALLBACK_PRODUCTS,
          firebase_status: 'fallback',
          firebase_error: firebaseError || 'Unknown error'
        });
      }
    }

    // POST – save to Firestore
    if (req.method === 'POST') {
      if (!db) {
        return res.status(503).json({
          success: false,
          error: 'Firestore not available',
          details: firebaseError || 'No Firebase connection'
        });
      }

      const {
        title, description, price, category, condition, location,
        images, quantity, deliveryOptions, sellerId, sellerEmail, sellerName
      } = req.body;

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
