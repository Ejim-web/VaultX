// server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

// Load .env if present
try { require('dotenv').config(); } catch (e) {}

// Firebase Admin (optional)
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
  console.log('✅ Firebase Admin initialized');
} catch (err) {
  console.warn('⚠️ Firebase Admin not configured – using static data');
}

const app = express();
app.use(cors());
app.use(express.json());
// Serve static files from current directory (index.html, etc.)
app.use(express.static('.'));

// ---------- Luxury static product catalog ----------
const staticProducts = [
  {
    id: 'p1',
    title: 'Patek Philippe Nautilus',
    description: 'Ref. 5711/1A-010, stainless steel, blue dial, 2023',
    price: 18500000, // $185,000.00
    sellerId: 'seller1',
    sellerEmail: 'luxury@watches.com',
    image: 'https://images.unsplash.com/photo-1533139502658-0198f920d8e8?w=400&h=300&fit=crop'
  },
  {
    id: 'p2',
    title: 'Gold Bullion 1kg',
    description: 'Pure 24k gold bar, LBMA certified, serialized',
    price: 72000000, // $720,000.00
    sellerId: 'seller2',
    sellerEmail: 'gold@bullion.com',
    image: 'https://images.unsplash.com/photo-1610375461246-83df859d8499?w=400&h=300&fit=crop'
  },
  {
    id: 'p3',
    title: 'Hermès Birkin 30',
    description: 'Himalayan crocodile, white gold hardware, rare',
    price: 45000000, // $450,000.00
    sellerId: 'seller3',
    sellerEmail: 'bags@hermes.com',
    image: 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=400&h=300&fit=crop'
  },
  {
    id: 'p4',
    title: 'Ferrari 250 GTO',
    description: '1962, one of only 39, concours restoration',
    price: 700000000, // $70,000,000.00
    sellerId: 'seller4',
    sellerEmail: 'cars@classic.com',
    image: 'https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=400&h=300&fit=crop'
  },
  {
    id: 'p5',
    title: 'Diamond Necklace',
    description: '18k gold, 50 carats VS1 diamonds, Cartier',
    price: 120000000, // $1,200,000.00
    sellerId: 'seller5',
    sellerEmail: 'jewels@cartier.com',
    image: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=400&h=300&fit=crop'
  }
];

// ---------- API routes ----------
app.get('/api/products', async (req, res) => {
  // If Firestore is available, try to fetch, else static
  if (db) {
    try {
      const snapshot = await db.collection('products').get();
      if (!snapshot.empty) {
        const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return res.json(products);
      }
    } catch (err) { console.error('Firestore fetch error:', err); }
  }
  // Fallback to static
  res.json(staticProducts);
});

app.post('/api/escrow/create', async (req, res) => {
  const { productId, buyerId, buyerEmail, sellerId, sellerEmail, amount } = req.body;
  if (!productId || !buyerId || !buyerEmail || !sellerId || !sellerEmail || !amount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // If Escrow keys missing, return dummy (for testing)
  if (!process.env.ESCROW_API_KEY || !process.env.ESCROW_API_SECRET) {
    console.warn('⚠️ Escrow credentials missing – returning dummy checkout');
    return res.json({
      checkoutUrl: 'https://sandbox.escrow.com/dummy-checkout',
      transactionId: 'dummy-tx-' + Date.now()
    });
  }

  try {
    const escrowPayload = {
      parties: [
        { email: buyerEmail, role: 'buyer' },
        { email: sellerEmail, role: 'seller' },
      ],
      items: [{ name: `Product #${productId}`, quantity: 1, price: amount / 100 }],
      currency: 'USD',
      return_url: `${process.env.BASE_URL || 'http://localhost:3000'}/?product=${productId}`,
      cancel_url: `${process.env.BASE_URL || 'http://localhost:3000'}/?product=${productId}`,
    };

    const escrowResponse = await axios.post(
      `${process.env.ESCROW_SANDBOX_URL || 'https://api.escrow-sandbox.com/2017-09-01'}/transaction`,
      escrowPayload,
      {
        auth: {
          username: process.env.ESCROW_API_KEY,
          password: process.env.ESCROW_API_SECRET,
        },
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const { id: escrowId, checkout_url: checkoutUrl } = escrowResponse.data;
    if (db) {
      const txRef = db.collection('transactions').doc();
      await txRef.set({
        id: txRef.id,
        productId,
        buyerId,
        buyerEmail,
        sellerId,
        sellerEmail,
        amount,
        escrowId,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    res.json({ checkoutUrl, transactionId: escrowId });
  } catch (error) {
    console.error('Escrow error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to create escrow transaction.' });
  }
});

app.post('/api/escrow/webhook', async (req, res) => {
  const { id: escrowId, status } = req.body;
  if (!escrowId || !status) return res.status(400).json({ error: 'Missing data' });

  let vaultStatus = 'pending';
  if (status === 'held') vaultStatus = 'held';
  else if (status === 'released') vaultStatus = 'released';
  else if (status === 'cancelled' || status === 'refunded') vaultStatus = 'cancelled';

  if (db) {
    try {
      const snapshot = await db.collection('transactions').where('escrowId', '==', escrowId).get();
      if (!snapshot.empty) {
        await snapshot.docs[0].ref.update({
          status: vaultStatus,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (err) { console.error('Webhook update error:', err); }
  }
  res.json({ success: true });
});

// ---------- Start server ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 VaultX server running on http://localhost:${PORT}`);
  console.log(`📄 Open your marketplace at http://localhost:${PORT}/`);
});
