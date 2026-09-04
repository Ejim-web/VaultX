// api/products.js – VaultX API (Static Fallback)
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
    // GET – returns static products
    if (req.method === 'GET') {
      return res.status(200).json({
        success: true,
        products: [
          {
            id: '1',
            title: 'Vintage Rolex Submariner',
            description: 'Classic 16610, complete set with box and papers.',
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
            id: '2',
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
          },
          {
            id: '3',
            title: 'Apple MacBook Pro M3 Max',
            description: '16-inch, 48GB RAM, 1TB SSD, Space Black.',
            price: 120000,
            category: 'Computers',
            condition: 'New',
            location: 'Port Harcourt, Nigeria',
            images: ['https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&h=300&fit=crop'],
            sellerName: 'Tech Store',
            verified: false,
            rating: 4.5
          }
        ]
      });
    }

    // POST – saves to Firestore (if Firebase is configured)
    if (req.method === 'POST') {
      // For now, just echo back the data
      const product = {
        id: 'product-' + Date.now(),
        ...req.body,
        timestamp: new Date().toISOString()
      };
      return res.status(201).json({ success: true, product });
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
