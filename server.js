// server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const admin = require('firebase-admin');
const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SDK_JSON);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});
const db = admin.firestore();

const app = express();
app.use(cors());
app.use(express.json());

// ---------- Create Escrow Transaction ----------
app.post('/api/escrow/create', async (req, res) => {
  const { productId, buyerId, buyerEmail, sellerId, sellerEmail, amount } = req.body;

  if (!productId || !buyerId || !buyerEmail || !sellerId || !sellerEmail || !amount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // 1. Call Escrow.com sandbox API
    const escrowPayload = {
      parties: [
        { email: buyerEmail, role: 'buyer' },
        { email: sellerEmail, role: 'seller' },
      ],
      items: [
        { name: `Product #${productId}`, quantity: 1, price: amount / 100 },
      ],
      currency: 'USD',
      return_url: `${process.env.BASE_URL}/product.html?id=${productId}`,
      cancel_url: `${process.env.BASE_URL}/product.html?id=${productId}`,
    };

    const escrowResponse = await axios.post(
      `${process.env.ESCROW_SANDBOX_URL}/transaction`,
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

    // 2. Save to Firestore
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

    res.json({ checkoutUrl, transactionId: txRef.id });
  } catch (error) {
    console.error('Escrow creation error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to create escrow transaction.' });
  }
});

// ---------- Webhook for Escrow status updates ----------
app.post('/api/escrow/webhook', async (req, res) => {
  const { id: escrowId, status } = req.body;

  if (!escrowId || !status) {
    return res.status(400).json({ error: 'Missing data' });
  }

  let vaultStatus = 'pending';
  if (status === 'held') vaultStatus = 'held';
  else if (status === 'released') vaultStatus = 'released';
  else if (status === 'cancelled' || status === 'refunded') vaultStatus = 'cancelled';

  try {
    const snapshot = await db.collection('transactions').where('escrowId', '==', escrowId).get();
    if (snapshot.empty) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    const doc = snapshot.docs[0];
    await doc.ref.update({
      status: vaultStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ---------- Get products (for demo, we seed static data) ----------
app.get('/api/products', async (req, res) => {
  // For simplicity, we return a fixed list. In production, fetch from Firestore.
  const products = [
    { id: 'p1', title: 'Vintage Watch', description: 'Rare 1960s Swiss automatic', price: 15000, sellerId: 'seller1', sellerEmail: 'seller@example.com' },
    { id: 'p2', title: 'Gold Bullion 1oz', description: 'Pure 24K gold bar', price: 200000, sellerId: 'seller2', sellerEmail: 'seller2@example.com' },
    { id: 'p3', title: 'Designer Bag', description: 'Limited edition, never used', price: 85000, sellerId: 'seller3', sellerEmail: 'seller3@example.com' },
  ];
  res.json(products);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
