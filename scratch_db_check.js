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
  
  const sql = "SELECT id, name, collection_name FROM products WHERE collection_name IS NOT NULL LIMIT 20";
  db.query(sql, (err, results) => {
    if (err) {
      console.error("Query failed", err);
    } else {
      console.log("Products with collections:", results);
    }
    
    db.query("SELECT * FROM bulk_offers", (err, offers) => {
        console.log("Offers count:", offers?.length);
        db.end();
    });
  });
});
