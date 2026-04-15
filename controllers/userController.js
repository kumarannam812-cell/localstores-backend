// Sync user activity (Likes, Visits, Orders) to MySQL
export const syncUserData = (req, res) => {
    const { phone, liked, visits, orders } = req.body;

    // We store the arrays as JSON strings in the TEXT columns of your SQL table
    const sql = "UPDATE users SET liked = ?, visits = ?, orders = ? WHERE phone = ?";
    
    db.query(sql, [JSON.stringify(liked), JSON.stringify(visits), JSON.stringify(orders), phone], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Data stored in database successfully" });
    });
};

// Retrieve data from MySQL after a refresh
export const getUserData = (req, res) => {
    const { phone } = req.params;
    const sql = "SELECT liked, visits, orders FROM users WHERE phone = ?";
    
    db.query(sql, [phone], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.length > 0) {
            // Parse the JSON strings back into Javascript arrays for React
            const data = result[0];
            res.json({
                liked: JSON.parse(data.liked || "[]"),
                visits: JSON.parse(data.visits || "[]"),
                orders: JSON.parse(data.orders || "[]")
            });
        } else {
            res.status(404).json({ message: "User not found" });
        }
    });
};