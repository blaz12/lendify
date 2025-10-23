// --- IMPORTS ---
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
// bcrypt is no longer used for this prototype version

// --- CONFIGURATION ---
const app = express();
const port = 3000;

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '', // Assumes default XAMPP password (blank)
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

// --- HELPER FUNCTION FOR ERROR HANDLING (Added for robustness) ---
const handleQuery = async (res, query, params = []) => {
  try {
    const [results] = await pool.query(query, params);
    return results;
  } catch (error) {
    console.error("Database query error:", error);
    // Avoid sending response if headers already sent (though less likely here)
    if (!res.headersSent) {
      res.status(500).json({ error: 'A database error occurred.' });
    }
    return null; // Indicate failure
  }
};


// --- API ROUTES ---

// Test route
app.get('/', (req, res) => {
  res.status(200).send('Lendify API Server is running (Plain Text Password Mode)!');
});

// === AUTHENTICATION API ===
app.post('/api/register', async (req, res) => {
    const { name, studentId, email, password } = req.body;
    if (!name || !studentId || !email || !password) {
        return res.status(400).json({ error: 'All fields are required.' });
    }
    try {
        const query = 'INSERT INTO users (name, studentId, email, password) VALUES (?, ?, ?, ?)';
        const [results] = await pool.query(query, [name, studentId, email, password]);
        res.status(201).json({ id: results.insertId, name, studentId, email, role: 'student' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
             res.status(409).json({ error: 'Student ID or email already exists.' });
        } else {
            console.error("Registration error:", error);
            res.status(500).json({ error: 'Failed to register user.' });
        }
    }
});

app.post('/api/login', async (req, res) => {
    // --- LOGIN DEBUG LOGS ---
    console.log('\n--- Received POST /api/login ---'); // Log 1: Request received
    const { studentId, password: plainTextPassword } = req.body;
    console.log(`Attempting login for studentId: ${studentId}`); // Log 2: Data received

    if (!studentId || !plainTextPassword) {
        console.log('Login failed: Missing studentId or password in request body.'); // Log 3: Validation failed
        return res.status(400).json({ error: 'Student ID and password are required.' });
    }

    try {
        console.log('Querying database for user...'); // Log 4: Before DB query
        // Ensure we only log in active users
        const [users] = await pool.query('SELECT * FROM users WHERE studentId = ? AND deletedAt IS NULL', [studentId]);
        console.log(`Database query returned ${users.length} user(s).`); // Log 5: After DB query

        if (users.length > 0) {
            const user = users[0];
            console.log('User found. Comparing passwords...'); // Log 6: User found

            // --- Simple text comparison ---
            if (user.password === plainTextPassword) {
                console.log('Password match! Login successful.'); // Log 7: Success
                const { password, deletedAt, ...userWithoutPassword } = user; // Exclude sensitive fields
                res.json(userWithoutPassword);
            } else {
                console.log('Password mismatch.'); // Log 8: Wrong password
                res.status(401).json({ error: 'Invalid credentials.' });
            }
        } else {
            console.log('User not found or is deleted.'); // Log 9: User not found
            res.status(401).json({ error: 'Invalid credentials.' });
        }
    } catch (error) {
        console.error("!!! Critical Login Error:", error); // Log 10: Catch block entered
        res.status(500).json({ error: 'A server error occurred during login.' });
    }
    // --- END LOGIN DEBUG LOGS ---
});

// === ITEMS API ===
app.get('/api/items', async (req, res) => {
  console.log('--- Received GET /api/items ---');
  const results = await handleQuery(res, 'SELECT * FROM items ORDER BY name ASC');
  if (results !== null) {
      res.json(results);
  }
});

app.post('/api/items', async (req, res) => {
  console.log('--- Received POST /api/items ---', req.body);
  const { name, category, stock, location } = req.body;
  const status = Number(stock) > 0 ? 'Available' : 'Out of Stock';
  const query = 'INSERT INTO items (name, category, stock, location, status) VALUES (?, ?, ?, ?, ?)';
  const results = await handleQuery(res, query, [name, category, stock, location, status]);
  if (results) res.status(201).json({ id: results.insertId, ...req.body, status });
});

app.put('/api/items/:id', async (req, res) => {
    console.log(`--- Received PUT /api/items/${req.params.id} ---`, req.body);
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
    console.log(`--- Received DELETE /api/items/${req.params.id} ---`);
    const { id } = req.params;
    // Note: If using soft delete for items later, this would change
    const query = 'DELETE FROM items WHERE id = ?';
    const results = await handleQuery(res, query, [id]);
    if (results && results.affectedRows > 0) {
        res.status(204).send();
    } else if (results) {
        res.status(404).json({ error: 'Item not found' });
    }
});


// === USERS API ===
app.get('/api/users', async (req, res) => {
    console.log('--- Received GET /api/users ---');
    const query = "SELECT id, name, studentId, email, role, createdAt FROM users WHERE deletedAt IS NULL ORDER BY name ASC";
    const results = await handleQuery(res, query);
     if (results !== null) res.json(results);
});

app.get('/api/users/deleted', async (req, res) => {
     console.log('--- Received GET /api/users/deleted ---');
     const query = "SELECT id, name, studentId, email, role, createdAt, deletedAt FROM users WHERE deletedAt IS NOT NULL ORDER BY deletedAt DESC";
     const results = await handleQuery(res, query);
     if (results !== null) res.json(results);
});

app.post('/api/users', async (req, res) => {
    console.log('--- Received POST /api/users ---', req.body);
    const { name, studentId, email, role } = req.body;
    const defaultPassword = 'password123'; // Admin creates user with a plain text default password
    const query = 'INSERT INTO users (name, studentId, email, password, role) VALUES (?, ?, ?, ?, ?)';
    try {
        const [results] = await pool.query(query, [name, studentId, email, defaultPassword, role || 'student']);
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
    console.log(`--- Received PUT /api/users/${req.params.id} ---`, req.body);
    const { id } = req.params;
    const { name, studentId, email, role } = req.body;
    const query = 'UPDATE users SET name = ?, studentId = ?, email = ?, role = ? WHERE id = ? AND deletedAt IS NULL';
    const results = await handleQuery(res, query, [name, studentId, email, role, id]);
     if (results && results.affectedRows > 0) {
        res.json({ id: parseInt(id, 10), name, studentId, email, role });
    } else if (results) {
        res.status(404).json({ error: 'Active user not found' });
    }
});

// DELETE (soft delete) a user
app.delete('/api/users/:id', async (req, res) => {
    // --- DELETE USER DEBUG LOGS ---
    const { id } = req.params;
    console.log(`\n--- Received DELETE /api/users/${id} ---`); // Log D1: Request received

    try {
        console.log(`Attempting to soft delete user ID: ${id}`); // Log D2: Starting logic
        // Set the deletedAt timestamp instead of actually deleting
        const query = 'UPDATE users SET deletedAt = CURRENT_TIMESTAMP WHERE id = ? AND deletedAt IS NULL';
        console.log('Executing query:', query.replace('?', id)); // Log D3: Before DB query
        
        // Use pool.query directly here to catch potential errors better
        const [results] = await pool.query(query, [id]);
        
        console.log('Database query result:', results); // Log D4: After DB query

        if (results.affectedRows > 0) {
            console.log(`User ID: ${id} soft deleted successfully.`); // Log D5: Success
            res.status(204).send(); // No content needed, signifies success
        } else {
            console.log(`User ID: ${id} not found or already deleted.`); // Log D6: Not found/already deleted
            res.status(404).json({ error: 'Active user not found or already deleted' });
        }
    } catch (error) {
         console.error(`!!! Critical Error Deleting User ID: ${id}:`, error); // Log D7: Catch block entered
         if (!res.headersSent) { // Check if response hasn't been sent
             res.status(500).json({ error: 'A server error occurred while deleting the user.' });
         }
    }
    // --- END DELETE USER DEBUG LOGS ---
});

app.put('/api/users/:id/recover', async (req, res) => {
    console.log(`--- Received PUT /api/users/${req.params.id}/recover ---`);
    const { id } = req.params;
    const query = 'UPDATE users SET deletedAt = NULL WHERE id = ? AND deletedAt IS NOT NULL';
    const results = await handleQuery(res, query, [id]);
    if (results && results.affectedRows > 0) {
         res.status(200).json({ message: 'User recovered successfully.' });
    } else if (results) {
        res.status(404).json({ error: 'Deleted user not found or user is already active' });
    }
});


// === BORROW RECORDS API ===
app.get('/api/borrow_records', async (req, res) => {
    console.log('--- Received GET /api/borrow_records ---');
    const query = `
        SELECT br.*, u.name as userName, i.name as itemName
        FROM borrow_records br
        JOIN users u ON br.userId = u.id
        JOIN items i ON br.itemId = i.id
        ORDER BY br.borrowedDate DESC
    `;
    const results = await handleQuery(res, query);
    if (results !== null) {
        res.json(results);
    }
});

app.post('/api/borrow', async (req, res) => { /* ... unchanged ... */ });
app.put('/api/return/:recordId', async (req, res) => { /* ... unchanged ... */ });

// --- START SERVER ---
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});

