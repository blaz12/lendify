// --- IMPORTS ---
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcrypt'); // For hashing passwords

// --- CONFIGURATION ---
const app = express();
const port = 3000;
const saltRounds = 10; // For bcrypt hashing

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '', // Your MySQL password (blank by default in XAMPP)
  database: 'lendify_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// --- DATABASE CONNECTION ---
const pool = mysql.createPool(dbConfig);

// --- HELPER FUNCTION FOR ERROR HANDLING ---
const handleQuery = async (res, query, params = []) => {
  try {
    const [results] = await pool.query(query, params);
    return results;
  } catch (error) {
    // This is a generic error handler. We'll add more specific ones below.
    console.error("Database query error:", error);
    res.status(500).json({ error: 'A database error occurred.' });
    return null;
  }
};

// --- API ROUTES (ENDPOINTS) ---

// Test route to confirm the server is running
app.get('/', (req, res) => {
  res.send('Lendify API Server is running!');
});

// === AUTHENTICATION API ===

app.post('/api/register', async (req, res) => {
    const { name, studentId, email, password } = req.body;
    if (!name || !studentId || !email || !password) {
        return res.status(400).json({ error: 'All fields are required.' });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const query = 'INSERT INTO users (name, studentId, email, password) VALUES (?, ?, ?, ?)';
        const [results] = await pool.query(query, [name, studentId, email, hashedPassword]);
        
        // Respond with the new user's data (excluding password)
        res.status(201).json({ id: results.insertId, name, studentId, email, role: 'student' });

    } catch (error) {
        // Check for duplicate entry error (MySQL error code ER_DUP_ENTRY)
        if (error.code === 'ER_DUP_ENTRY') {
             res.status(409).json({ error: 'Student ID or email already exists.' });
        } else {
            console.error("Registration error:", error);
            res.status(500).json({ error: 'Failed to register user.' });
        }
    }
});

app.post('/api/login', async (req, res) => {
    const { studentId, password } = req.body;
    if (!studentId || !password) {
        return res.status(400).json({ error: 'Student ID and password are required.' });
    }
    
    const users = await handleQuery(res, 'SELECT * FROM users WHERE studentId = ?', [studentId]);
    if (users && users.length > 0) {
        const user = users[0];
        // Compare the provided password with the hashed password in the database
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (passwordMatch) {
            // Successful login, return user data without the password
            const { password, ...userWithoutPassword } = user;
            res.json(userWithoutPassword);
        } else {
            // Password does not match
            res.status(401).json({ error: 'Invalid credentials.' });
        }
    } else if (users) {
        // User not found
        res.status(401).json({ error: 'Invalid credentials.' });
    }
});


// === ITEMS API (Admin protected in a real app) ===
app.get('/api/items', async (req, res) => {
  const results = await handleQuery(res, 'SELECT * FROM items ORDER BY name ASC');
  if (results) res.json(results);
});

app.post('/api/items', async (req, res) => {
  const { name, category, stock, location } = req.body;
  const status = Number(stock) > 0 ? 'Available' : 'Out of Stock';
  const query = 'INSERT INTO items (name, category, stock, location, status) VALUES (?, ?, ?, ?, ?)';
  const results = await handleQuery(res, query, [name, category, stock, location, status]);
  if (results) res.status(201).json({ id: results.insertId, ...req.body, status });
});

app.put('/api/items/:id', async (req, res) => {
    const { id } = req.params;
    const { name, category, stock, location } = req.body;
    const status = Number(stock) > 0 ? 'Available' : 'Out of Stock';
    const query = 'UPDATE items SET name = ?, category = ?, stock = ?, location = ?, status = ? WHERE id = ?';
    const results = await handleQuery(res, query, [name, category, stock, location, status, id]);
    if (results && results.affectedRows > 0) {
        res.json({ id: parseInt(id, 10), ...req.body, status });
    } else if (results) {
        res.status(404).json({ error: 'Item not found' });
    }
});

app.delete('/api/items/:id', async (req, res) => {
    const { id } = req.params;
    const results = await handleQuery(res, 'DELETE FROM items WHERE id = ?', [id]);
    if (results && results.affectedRows > 0) {
        res.status(204).send();
    } else if (results) {
        res.status(404).json({ error: 'Item not found' });
    }
});

// === USERS API (Admin protected in a real app) ===
app.get('/api/users', async (req, res) => {
    // Select all fields except the password hash for security
    const query = "SELECT id, name, studentId, email, role, createdAt FROM users ORDER BY name ASC";
    const results = await handleQuery(res, query);
    if (results) res.json(results);
});

// POST (create) a new user - FOR ADMINS
app.post('/api/users', async (req, res) => {
    const { name, studentId, email, role } = req.body;
    // Admins can create users with a default password.
    const defaultPassword = 'password123'; // Consider making this more secure or configurable
    try {
        const hashedPassword = await bcrypt.hash(defaultPassword, saltRounds);
        const query = 'INSERT INTO users (name, studentId, email, password, role) VALUES (?, ?, ?, ?, ?)';
        const [results] = await pool.query(query, [name, studentId, email, hashedPassword, role || 'student']);
        res.status(201).json({ id: results.insertId, name, studentId, email, role: role || 'student' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
             res.status(409).json({ error: 'Student ID or email already exists.' });
        } else {
            console.error("Admin user creation error:", error);
            res.status(500).json({ error: 'Failed to create user.' });
        }
    }
});


app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { name, studentId, email, role } = req.body;
    // Note: Password changes should be a separate, more secure endpoint and are omitted here for simplicity.
    const query = 'UPDATE users SET name = ?, studentId = ?, email = ?, role = ? WHERE id = ?';
    const results = await handleQuery(res, query, [name, studentId, email, role, id]);
    if (results && results.affectedRows > 0) {
        res.json({ id: parseInt(id, 10), name, studentId, email, role });
    } else if (results) {
        res.status(404).json({ error: 'User not found' });
    }
});

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
app.get('/api/borrow_records', async (req, res) => {
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

app.post('/api/borrow', async (req, res) => {
    const { userId, itemId } = req.body;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [items] = await connection.query('SELECT stock FROM items WHERE id = ? FOR UPDATE', [itemId]);
        if (items.length === 0 || items[0].stock <= 0) {
            await connection.rollback();
            return res.status(400).json({ error: 'Item is out of stock or does not exist.' });
        }
        await connection.query('UPDATE items SET stock = stock - 1 WHERE id = ?', [itemId]);
        const borrowQuery = 'INSERT INTO borrow_records (userId, itemId, status) VALUES (?, ?, "Borrowed")';
        await connection.query(borrowQuery, [userId, itemId]);
        await connection.query('UPDATE items SET status = "Out of Stock" WHERE id = ? AND stock = 0', [itemId]);
        await connection.commit();
        res.status(201).json({ message: 'Item borrowed successfully.' });
    } catch (error) {
        await connection.rollback();
        console.error("Borrow transaction failed:", error);
        res.status(500).json({ error: 'A database error occurred during the borrow process.' });
    } finally {
        connection.release();
    }
});

app.put('/api/return/:recordId', async (req, res) => {
    const { recordId } = req.params;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [records] = await connection.query('SELECT itemId FROM borrow_records WHERE id = ? AND status = "Borrowed" FOR UPDATE', [recordId]);
        if (records.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Active borrow record not found.' });
        }
        const { itemId } = records[0];
        const updateRecordQuery = 'UPDATE borrow_records SET status = "Returned", returnedDate = CURRENT_TIMESTAMP WHERE id = ?';
        await connection.query(updateRecordQuery, [recordId]);
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

