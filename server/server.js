// A simple Express.js server to connect to a MySQL database for the Lendify app.

// --- IMPORTS ---
const express = require('express');
const mysql = require('mysql2/promise'); // Using the promise-based wrapper for async/await
const cors = require('cors');

// --- CONFIGURATION ---
const app = express();
const port = 3000; // You can change this port if needed

// IMPORTANT: Replace these with your actual MySQL database credentials.
const dbConfig = {
  host: 'localhost',
  user: 'root', // Your MySQL username
  password: '', // Your MySQL password (blank by default in XAMPP)
  database: 'lendify_db', // The name of your database
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// --- MIDDLEWARE ---
// Enable Cross-Origin Resource Sharing (CORS) so your Angular app can call this server
app.use(cors());
// Enable parsing of JSON in request bodies
app.use(express.json());

// --- DATABASE CONNECTION ---
// Create a connection pool for better performance and handling multiple connections
const pool = mysql.createPool(dbConfig);

// --- HELPER FUNCTION FOR ERROR HANDLING ---
const handleQuery = async (res, query, params = []) => {
  try {
    const [results] = await pool.query(query, params);
    return results;
  } catch (error) {
    console.error("Database query error:", error);
    res.status(500).json({ error: 'A database error occurred.' });
    return null;
  }
};

// --- API ROUTES (ENDPOINTS) ---

// Test route
app.get('/', (req, res) => {
  res.send('Lendify API Server is running and connected!');
});

// === ITEMS API ===

// GET all equipment items
app.get('/api/items', async (req, res) => {
  const results = await handleQuery(res, 'SELECT * FROM items ORDER BY name ASC');
  if (results) res.json(results);
});

// POST (create) a new item
app.post('/api/items', async (req, res) => {
  const { name, category, stock, location } = req.body;
  const status = Number(stock) > 0 ? 'Available' : 'Out of Stock';
  const query = 'INSERT INTO items (name, category, stock, location, status) VALUES (?, ?, ?, ?, ?)';
  const results = await handleQuery(res, query, [name, category, stock, location, status]);
  if (results) res.status(201).json({ id: results.insertId, ...req.body, status });
});

// PUT (update) an existing item
app.put('/api/items/:id', async (req, res) => {
    const { id } = req.params;
    const { name, category, stock, location } = req.body;
    const status = Number(stock) > 0 ? 'Available' : 'Out of Stock';
    const query = 'UPDATE items SET name = ?, category = ?, stock = ?, location = ?, status = ? WHERE id = ?';
    const results = await handleQuery(res, query, [name, category, stock, location, status, id]);
    if (results && results.affectedRows > 0) {
        res.json({ id, ...req.body, status });
    } else if (results) {
        res.status(404).json({ error: 'Item not found' });
    }
});

// DELETE an item
app.delete('/api/items/:id', async (req, res) => {
    const { id } = req.params;
    const results = await handleQuery(res, 'DELETE FROM items WHERE id = ?', [id]);
    if (results && results.affectedRows > 0) {
        res.status(204).send(); // 204 No Content for successful deletion
    } else if (results) {
        res.status(404).json({ error: 'Item not found' });
    }
});

// === USERS API ===

// GET all users
app.get('/api/users', async (req, res) => {
    const results = await handleQuery(res, 'SELECT * FROM users ORDER BY name ASC');
    if (results) res.json(results);
});

// POST (create) a new user
app.post('/api/users', async (req, res) => {
    const { name, studentId, email } = req.body;
    const query = 'INSERT INTO users (name, studentId, email) VALUES (?, ?, ?)';
    const results = await handleQuery(res, query, [name, studentId, email]);
    if (results) res.status(201).json({ id: results.insertId, ...req.body });
});

// PUT (update) an existing user
app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { name, studentId, email } = req.body;
    const query = 'UPDATE users SET name = ?, studentId = ?, email = ? WHERE id = ?';
    const results = await handleQuery(res, query, [name, studentId, email, id]);
    if (results && results.affectedRows > 0) {
        res.json({ id, ...req.body });
    } else if (results) {
        res.status(404).json({ error: 'User not found' });
    }
});

// DELETE a user
app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const results = await handleQuery(res, 'DELETE FROM users WHERE id = ?', [id]);
    if (results && results.affectedRows > 0) {
        res.status(204).send();
    } else if (results) {
        res.status(404).json({ error: 'User not found' });
    }
});


// === BORROW RECORDS API ===

// GET all borrow records (can be useful for admins)
app.get('/api/borrow_records', async (req, res) => {
    // Joining tables to get user and item names directly
    const query = `
        SELECT br.*, u.name as userName, i.name as itemName 
        FROM borrow_records br
        JOIN users u ON br.userId = u.id
        JOIN items i ON br.itemId = i.id
        ORDER BY br.borrowedDate DESC
    `;
    const results = await handleQuery(res, query);
    if (results) res.json(results);
});

// POST (borrow) a new item
app.post('/api/borrow', async (req, res) => {
    const { userId, itemId } = req.body;

    const connection = await pool.getConnection(); // Get a connection for the transaction
    try {
        await connection.beginTransaction();

        // 1. Check if item is in stock
        const [items] = await connection.query('SELECT stock FROM items WHERE id = ? FOR UPDATE', [itemId]);
        if (items.length === 0 || items[0].stock <= 0) {
            await connection.rollback();
            return res.status(400).json({ error: 'Item is out of stock or does not exist.' });
        }

        // 2. Decrement stock
        await connection.query('UPDATE items SET stock = stock - 1 WHERE id = ?', [itemId]);

        // 3. Create borrow record
        const borrowQuery = 'INSERT INTO borrow_records (userId, itemId, status) VALUES (?, ?, "Borrowed")';
        await connection.query(borrowQuery, [userId, itemId]);

        // 4. Update item status if it's now out of stock
        await connection.query('UPDATE items SET status = "Out of Stock" WHERE id = ? AND stock = 0', [itemId]);

        await connection.commit(); // Commit the transaction
        res.status(201).json({ message: 'Item borrowed successfully.' });

    } catch (error) {
        await connection.rollback(); // Rollback on any error
        console.error("Borrow transaction failed:", error);
        res.status(500).json({ error: 'A database error occurred during the borrow process.' });
    } finally {
        connection.release(); // Always release the connection back to the pool
    }
});


// PUT (return) an item
app.put('/api/return/:recordId', async (req, res) => {
    const { recordId } = req.params;

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Find the borrow record and the associated item ID
        const [records] = await connection.query('SELECT itemId FROM borrow_records WHERE id = ? AND status = "Borrowed" FOR UPDATE', [recordId]);
        if (records.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Active borrow record not found.' });
        }
        const { itemId } = records[0];

        // 2. Update the borrow record
        const updateRecordQuery = 'UPDATE borrow_records SET status = "Returned", returnedDate = CURRENT_TIMESTAMP WHERE id = ?';
        await connection.query(updateRecordQuery, [recordId]);

        // 3. Increment the item's stock and set status to 'Available'
        const updateItemQuery = 'UPDATE items SET stock = stock + 1, status = "Available" WHERE id = ?';
        await connection.query(updateItemQuery, [itemId]);

        await connection.commit();
        res.json({ message: 'Item returned successfully.' });

    } catch (error) {
        await connection.rollback();
        console.error("Return transaction failed:", error);
        res.status(500).json({ error: 'A database error occurred during the return process.' });
    } finally {
        connection.release();
    }
});


// --- START SERVER ---
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});

