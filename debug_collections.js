const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "12345",
  database: "ecommerce"
});

db.connect((err) => {
  if (err) {
    console.error("Connection failed", err);
    process.exit(1);
  }
  
  const sql = `
    SELECT 
      p.collection_name,
      p.seller_id,
      s.shop_name,
      s.id as seller_table_id
    FROM products p
    LEFT JOIN sellers s ON p.seller_id = s.id
    WHERE p.collection_name IS NOT NULL AND p.collection_name != ''
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Query failed", err);
    } else {
      console.log("Raw Collection Data:", results);
      
      const checkProducts = "SELECT id, name, collection_name, seller_id FROM products LIMIT 5";
      db.query(checkProducts, (err, prods) => {
         console.log("Sample Products:", prods);
         db.end();
      });
    }
  });
});
