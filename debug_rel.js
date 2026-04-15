const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "12345",
  database: "ecommerce"
});

db.connect((err) => {
  if (err) { console.error(err); process.exit(1); }
  
  console.log("--- DEBUG RELATIONSHIP ---");
  
  // 1. Check products with collection
  db.query("SELECT id, seller_id, collection_name FROM products WHERE collection_name IS NOT NULL", (err, prods) => {
    console.log("Products with collection:", prods);
    
    if (prods.length > 0) {
      const sellerId = prods[0].seller_id;
      // 2. Check if this seller exists
      db.query("SELECT id, shop_name FROM sellers WHERE id = ?", [sellerId], (err, sellers) => {
        console.log(`Seller with ID ${sellerId}:`, sellers);
        
        // 3. Test the full query
        const sql = `
          SELECT 
            p.collection_name,
            p.seller_id,
            s.shop_name
          FROM products p
          JOIN sellers s ON p.seller_id = s.id
          WHERE p.collection_name IS NOT NULL AND p.collection_name != ''
        `;
        db.query(sql, (err, collections) => {
          console.log("Full query result:", collections);
          db.end();
        });
      });
    } else {
      console.log("No products found with collection_name.");
      db.end();
    }
  });
});
