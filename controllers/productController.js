const db = require("../db");

// ADD PRODUCT - with seller_id from localStorage
exports.addProduct = (req, res) => {
  const { seller_id, name, price, image, category, shop, offer, is_new, collection_name } = req.body;

  // Validate required fields
  if (!seller_id || !name || !price || !shop) {
    return res.status(400).json({ 
      message: "Missing required fields: seller_id, name, price, shop" 
    });
  }

  const sql = `INSERT INTO products 
    (seller_id, name, price, image, category, shop, offer, is_new, collection_name) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  const values = [seller_id, name, price, image, category || "General", shop, offer || 0, is_new !== false ? 1 : 0, collection_name || null];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error("❌ MySQL Error:", err.sqlMessage);
      return res.status(500).json({ 
        message: "Database Error", 
        detail: err.sqlMessage 
      });
    }

    console.log("✅ Product Added - ID:", result.insertId, "Shop:", shop);
    res.status(200).json({ 
      message: "Product added successfully", 
      id: result.insertId,
      product: { id: result.insertId, name, price, shop }
    });
  });
};

// GET ALL PRODUCTS
exports.getProducts = (req, res) => {
  db.query("SELECT * FROM products ORDER BY created_at DESC", (err, result) => {
    if (err) {
      console.error("❌ Error fetching products:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }
    res.status(200).json(result || []);
  });
};

// GET PRODUCTS BY SELLER
exports.getProductsBySeller = (req, res) => {
  const { sellerId } = req.params;
  
  db.query("SELECT * FROM products WHERE seller_id = ?", [sellerId], (err, result) => {
    if (err) {
      return res.status(500).json({ error: err.sqlMessage });
    }
    res.status(200).json(result || []);
  });
};

// DELETE PRODUCT
exports.deleteProduct = (req, res) => {
  const { productId } = req.params;
  
  db.query("DELETE FROM products WHERE id = ?", [productId], (err, result) => {
    if (err) {
      return res.status(500).json({ error: err.sqlMessage });
    }
    res.status(200).json({ message: "Product deleted successfully" });
  });
};