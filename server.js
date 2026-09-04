// server.js – VaultX Backend (with product creation)
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

// ---------- Firebase Admin ----------
let admin, db;
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SDK_JSON);
  admin = require('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  }
  db = admin.firestore();
  console.log('✅ Firebase Admin connected');
} catch (err) {
  console.warn('⚠️ Firebase Admin not configured – using static fallback');
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // allow larger payloads (images as base64)
app.use(express.static('.')); // serve index.html

// ---------- GET /api/products ----------
app.get('/api/products', async (req, res) => {
  try {
    if (db) {
      const snapshot = await db.collection('products')
        .orderBy('timestamp', 'desc')
        .get();
      if (!snapshot.empty) {
        const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return res.json({ success: true, products });
      }
      // No products in Firestore – return empty array
      return res.json({ success: true, products: [] });
    }
    // Fallback static products (only if Firestore is unavailable)
    const staticProducts = [
      { id: 'p1', title: 'Patek Philippe Nautilus', description: 'Ref. 5711/1A-010, stainless steel', price: 18500000, sellerId: 'seller1', sellerEmail: 'luxury@watches.com', image: 'https://images.unsplash.com/photo-1533139502658-0198f920d8e8?w=400&h=300&fit=crop', location: 'Geneva', condition: 'New', rating: 4.9, verified: true, category: 'Jewelry & Watches' },
      { id: 'p2', title: 'Gold Bullion 1kg', description: 'Pure 24k gold, LBMA certified', price: 72000000, sellerId: 'seller2', sellerEmail: 'gold@bullion.com', image: 'https://images.unsplash.com/photo-1610375461246-83df859d8499?w=400&h=300&fit=crop', location: 'Zurich', condition: 'New', rating: 5.0, verified: true, category: 'Jewelry & Watches' }
    ];
    res.json({ success: true, products: staticProducts });
  } catch (error) {
    console.error('Products error:', error);
    res.status(500).json({ success: false, error: 'Unable to load products. Please try again.' });
  }
});

// ---------- POST /api/products (create new product) ----------
app.post('/api/products', async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      category,
      condition,
      location,
      images, // array of image URLs (from Firebase Storage)
      quantity,
      deliveryOptions,
      sellerId,
      sellerEmail,
      sellerName
    } = req.body;

    // Basic validation
    if (!title || !price || !category || !sellerId) {
      return res.status(400).json({ success: false, error: 'Missing required fields.' });
    }

    if (!db) {
      return res.status(503).json({ success: false, error: 'Database not available.' });
    }

    // Build product object
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
      verified: false, // default
      rating: 0,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      status: 'active'
    };

    const docRef = await db.collection('products').add(product);
    const newProduct = { id: docRef.id, ...product };
    // Convert timestamp to ISO for response
    newProduct.timestamp = new Date().toISOString();

    res.status(201).json({ success: true, product: newProduct });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ success: false, error: 'Failed to create product.' });
  }
});

// ---------- API: Create Escrow (dummy for now) ----------
app.post('/api/escrow/create', async (req, res) => {
  res.json({ checkoutUrl: 'https://sandbox.escrow.com/dummy', transactionId: 'dummy' });
});

// ---------- Start ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 VaultX server running on http://localhost:${PORT}`);
  console.log(`📄 Open your marketplace at http://localhost:${PORT}/`);
});
