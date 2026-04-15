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
  
  console.log("Adding collection_name column...");
  const sql = "ALTER TABLE products ADD COLUMN collection_name VARCHAR(255) DEFAULT NULL";
  
  db.query(sql, (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_COLUMN_NAME') {
        console.log("✅ Column already exists.");
      } else {
        console.error("❌ Failed to add column:", err);
      }
    } else {
      console.log("✅ Column added successfully!");
    }
    db.end();
  });
});
