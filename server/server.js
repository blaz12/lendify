// A simple Express.js server to connect to a MySQL database for the Lendify app.

// --- IMPORTS ---
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

// --- CONFIGURATION ---
const app = express();
const port = 3000; // You can change this port if needed

// IMPORTANT: Replace these with your actual MySQL database credentials.
const dbConfig = {
  host: 'localhost',
  user: 'root', // Your MySQL username
  password: '', // Your MySQL password
  database: 'lendify_db' // The name of your database
};

// --- MIDDLEWARE ---
// Enable Cross-Origin Resource Sharing (CORS) so your Angular app can call this server
app.use(cors());
// Enable parsing of JSON in request bodies
app.use(express.json());

// --- DATABASE CONNECTION ---
// Create a connection pool for better performance
const pool = mysql.createPool(dbConfig);

// --- API ROUTES (ENDPOINTS) ---

// Test route
app.get('/', (req, res) => {
  res.send('Lendify API Server is running!');
});

// GET all equipment items
app.get('/api/items', (req, res) => {
  pool.query('SELECT * FROM items', (error, results) => {
    if (error) {
      console.error("Error fetching items:", error);
      return res.status(500).json({ error: 'Database query failed' });
    }
    res.json(results);
  });
});

// GET all users
app.get('/api/users', (req, res) => {
  pool.query('SELECT * FROM users', (error, results) => {
    if (error) {
      console.error("Error fetching users:", error);
      return res.status(500).json({ error: 'Database query failed' });
    }
    res.json(results);
  });
});

// GET all borrow records
app.get('/api/borrow_records', (req, res) => {
  pool.query('SELECT * FROM borrow_records', (error, results) => {
    if (error) {
      console.error("Error fetching records:", error);
      return res.status(500).json({ error: 'Database query failed' });
    }
    res.json(results);
  });
});

// POST (create) a new item
app.post('/api/items', (req, res) => {
  const { name, category, stock, location } = req.body;
  const status = stock > 0 ? 'Available' : 'Out of Stock';
  const query = 'INSERT INTO items (name, category, stock, location, status) VALUES (?, ?, ?, ?, ?)';
  
  pool.query(query, [name, category, stock, location, status], (error, results) => {
    if (error) {
      console.error("Error creating item:", error);
      return res.status(500).json({ error: 'Database insert failed' });
    }
    res.status(201).json({ id: results.insertId, ...req.body, status });
  });
});

// PUT (update) an existing item
app.put('/api/items/:id', (req, res) => {
    const { id } = req.params;
    const { name, category, stock, location } = req.body;
    const status = stock > 0 ? 'Available' : 'Out of Stock';
    const query = 'UPDATE items SET name = ?, category = ?, stock = ?, location = ?, status = ? WHERE id = ?';

    pool.query(query, [name, category, stock, location, status, id], (error, results) => {
        if (error) {
            console.error("Error updating item:", error);
            return res.status(500).json({ error: 'Database update failed' });
        }
        if (results.affectedRows === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }
        res.json({ id, ...req.body, status });
    });
});

// DELETE an item
app.delete('/api/items/:id', (req, res) => {
    const { id } = req.params;
    const query = 'DELETE FROM items WHERE id = ?';

    pool.query(query, [id], (error, results) => {
        if (error) {
            console.error("Error deleting item:", error);
            return res.status(500).json({ error: 'Database delete failed' });
        }
        if (results.affectedRows === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }
        res.status(204).send(); // 204 No Content for successful deletion
    });
});


// Add more routes for users and borrow_records following the same pattern...


// --- START SERVER ---
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
