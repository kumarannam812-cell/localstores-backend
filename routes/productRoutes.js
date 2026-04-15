const express = require("express");
const router = express.Router();
const db = require("../db");
const { addProduct, getProducts, deleteProduct } = require("../controllers/productController");

// Add new product
router.post("/add", addProduct);

// Get all products
router.get("/", getProducts);

// Get products by seller
router.get("/seller/:id", (req, res) => {
  const sellerId = req.params.id;
  
  db.query(
    "SELECT * FROM products WHERE seller_id = ?",
    [sellerId],
    (err, results) => {
      if (err) {
        return res.status(500).json({ error: "Database error" });
      }
      res.json(results || []);
    }
  );
});

// Get products by shop name
router.get("/shop/:shopName", (req, res) => {
  const { shopName } = req.params;
  
  db.query(
    "SELECT * FROM products WHERE shop = ?",
    [shopName],
    (err, results) => {
      if (err) {
        return res.status(500).json({ error: "Database error" });
      }
      res.json(results || []);
    }
  );
});

// Delete product
router.delete("/:id", deleteProduct);

module.exports = router;