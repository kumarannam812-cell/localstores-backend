const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "12345",
  database: "ecommerce"
});

const productPayload = {
    seller_id: 1,
    name: "Debug Pant",
    price: 999.00,
    image: "test.jpg",
    images: JSON.stringify(["test.jpg"]),
    shop: "Sanjeev Fashions",
    category: "Mens",
    color: "Black",
    sizes: JSON.stringify(["28", "30"]),
    stock: 10,
    description: "Debug test",
    collection_name: "Debug Collection"
};

db.connect((err) => {
  if (err) { console.error(err); process.exit(1); }
  
  const sql = `INSERT INTO products 
               (seller_id, name, price, image, images, shop, category, color, sizes, stock, description, collection_name) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  const values = [
    productPayload.seller_id,
    productPayload.name,
    productPayload.price,
    productPayload.image,
    productPayload.images,
    productPayload.shop,
    productPayload.category,
    productPayload.color,
    productPayload.sizes,
    productPayload.stock,
    productPayload.description,
    productPayload.collection_name
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error("❌ INSERT FAILED:", err);
    } else {
      console.log("✅ INSERT SUCCESS! ID:", result.insertId);
      
      db.query("SELECT * FROM products WHERE id = ?", [result.insertId], (err, rows) => {
          console.log("Row saved:", rows[0]);
          db.end();
      });
    }
  });
});
