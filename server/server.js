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
  queueLimit: 0,
  multipleStatements: false // Important for security and transactions
};

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// --- DATABASE CONNECTION ---
const pool = mysql.createPool(dbConfig);

// --- HELPER FUNCTION FOR ERROR HANDLING ---
const handleQuery = async (res, query, params = []) => {
  // Use this for simple, non-transactional queries
  try {
    const [results] = await pool.query(query, params);
    return results;
  } catch (error) {
    console.error("Database query error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'A database error occurred.' });
    }
    return null;
  }
};


// --- API ROUTES ---

// Test route
app.get('/', (req, res) => {
  res.status(200).send('Lendify API Server is running (Plain Text Password Mode)!');
});

// === AUTHENTICATION API ===
app.post('/api/register', async (req, res) => {
    console.log('\n--- Received POST /api/register ---', req.body);
    const { name, studentId, email, password } = req.body;
    if (!name || !studentId || !email || !password) {
        return res.status(400).json({ error: 'All fields are required.' });
    }
    // No hashing, just save the password directly as plain text
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
    console.log('\n--- Received POST /api/login ---');
    const { studentId, password: plainTextPassword } = req.body;
    console.log(`Attempting login for studentId: ${studentId}`);

    if (!studentId || !plainTextPassword) {
        console.log('Login failed: Missing studentId or password in request body.');
        return res.status(400).json({ error: 'Student ID and password are required.' });
    }

    try {
        console.log('Querying database for user...');
        // Ensure we only log in active users
        const [users] = await pool.query('SELECT * FROM users WHERE studentId = ? AND deletedAt IS NULL', [studentId]);
        console.log(`Database query returned ${users.length} user(s).`);

        if (users.length > 0) {
            const user = users[0];
            console.log('User found. Comparing passwords...');

            // --- Simple text comparison ---
            if (user.password === plainTextPassword) {
                console.log('Password match! Login successful.');
                const { password, deletedAt, ...userWithoutPassword } = user; // Exclude sensitive fields
                res.json(userWithoutPassword);
            } else {
                console.log('Password mismatch.');
                res.status(401).json({ error: 'Invalid credentials.' });
            }
        } else {
            console.log('User not found or is deleted.');
            res.status(401).json({ error: 'Invalid credentials.' });
        }
    } catch (error) {
        console.error("!!! Critical Login Error:", error);
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
        const query = 'UPDATE users SET deletedAt = CURRENT_TIMESTAMP WHERE id = ? AND deletedAt IS NULL';
        console.log('Executing query:', query.replace('?', id)); // Log D3: Before DB query
        const [results] = await pool.query(query, [id]);
        console.log('Database query result:', results); // Log D4: After DB query

        if (results.affectedRows > 0) {
            console.log(`User ID: ${id} soft deleted successfully.`); // Log D5: Success
            res.status(204).send();
        } else {
            console.log(`User ID: ${id} not found or already deleted.`); // Log D6: Not found/already deleted
            res.status(404).json({ error: 'Active user not found or already deleted' });
        }
    } catch (error) {
         console.error(`!!! Critical Error Deleting User ID: ${id}:`, error); // Log D7: Catch block entered
         if (!res.headersSent) {
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
        SELECT br.*, u.name as userName, u.studentId, i.name as itemName
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

// POST /api/borrow (Single item)
app.post('/api/borrow', async (req, res) => {
    // --- BORROW ITEM DEBUG LOGS ---
    console.log('\n--- Received POST /api/borrow ---', req.body); // Log B1: Request received
    const { userId, itemId } = req.body;
    let connection;
    // ... (rest of single borrow logic with logs B2-B20)...
     if (!userId || !itemId) {
        console.log('Borrow failed: Missing userId or itemId.'); // Log B2
        return res.status(400).json({ error: 'User ID and Item ID are required.' });
    }
    try {
        console.log(`Attempting to borrow item ID: ${itemId} for user ID: ${userId}`); // Log B3: Starting logic
        connection = await pool.getConnection(); // Get a connection for the transaction
        console.log('Obtained database connection.'); // Log B4: Got connection

        await connection.beginTransaction();
        console.log('Started database transaction.'); // Log B5: Transaction started

        console.log('Checking item stock...'); // Log B6: Before stock check
        const [items] = await connection.query('SELECT stock FROM items WHERE id = ? FOR UPDATE', [itemId]);
        console.log(`Stock check query returned ${items.length} item(s).`); // Log B7: After stock check

        if (items.length === 0 || items[0].stock <= 0) {
            console.log('Item out of stock or does not exist. Rolling back transaction.'); // Log B8: Out of stock
            await connection.rollback();
            return res.status(400).json({ error: 'Item is out of stock or does not exist.' });
        }
        console.log(`Item stock is: ${items[0].stock}. Proceeding...`); // Log B9: Stock available

        console.log('Decrementing item stock...'); // Log B10: Before stock decrement
        await connection.query('UPDATE items SET stock = stock - 1 WHERE id = ?', [itemId]);
        console.log('Item stock decremented.'); // Log B11: After stock decrement

        console.log('Creating borrow record...'); // Log B12: Before borrow record creation
        const borrowQuery = 'INSERT INTO borrow_records (userId, itemId, status) VALUES (?, ?, "Borrowed")';
        await connection.query(borrowQuery, [userId, itemId]);
        console.log('Borrow record created.'); // Log B13: After borrow record creation

        console.log('Checking if item needs status update (stock = 0)...'); // Log B14: Before status check
        await connection.query('UPDATE items SET status = "Out of Stock" WHERE id = ? AND stock = 0', [itemId]);
        console.log('Potential status update query executed.'); // Log B15: After status check

        await connection.commit(); // Commit the transaction
        console.log('Transaction committed successfully.'); // Log B16: Commit success
        res.status(201).json({ message: 'Item borrowed successfully.' });

    } catch (error) {
        console.error("!!! Critical Borrow Transaction Failed:", error); // Log B17: Catch block entered
        if (connection) {
            console.log('Rolling back transaction due to error...'); // Log B18: Rolling back
            await connection.rollback();
        }
        if (!res.headersSent) {
            res.status(500).json({ error: 'A database error occurred during the borrow process.' });
        }
    } finally {
        if (connection) {
            console.log('Releasing database connection.'); // Log B19: Releasing connection
            connection.release();
        } else {
             console.log('No database connection to release.'); // Log B20: No connection to release
        }
    }
    // --- END BORROW ITEM DEBUG LOGS ---
});

// POST /api/borrow/batch (Multi-item borrowing)
app.post('/api/borrow/batch', async (req, res) => {
    console.log('\n--- Received POST /api/borrow/batch ---', req.body);
    const { userId, items: itemsToBorrow, usageLocation, occasion } = req.body; // itemsToBorrow = { itemId: quantity }
    let connection;

    // Basic Validation
    if (!userId || !itemsToBorrow || Object.keys(itemsToBorrow).length === 0 || !usageLocation || !occasion) {
        console.log('Batch borrow failed: Missing required fields.');
        return res.status(400).json({ error: 'User ID, items list, usage location, and occasion are required.' });
    }

    const itemEntries = Object.entries(itemsToBorrow).map(([id, qty]) => ({
        itemId: parseInt(id, 10),
        quantity: parseInt(qty, 10)
    }));

    if (itemEntries.some(item => isNaN(item.itemId) || isNaN(item.quantity) || item.quantity <= 0)) {
         console.log('Batch borrow failed: Invalid item ID or quantity.');
         return res.status(400).json({ error: 'Invalid item ID or quantity provided.' });
    }

    try {
        console.log(`Starting batch borrow for user ID: ${userId}`);
        connection = await pool.getConnection();
        console.log('Obtained connection. Starting transaction.');
        await connection.beginTransaction();

        // 1. Verify stock for ALL items first (lock rows)
        console.log('Verifying stock for all requested items...');
        const stockChecks = itemEntries.map(item =>
            connection.query('SELECT name, stock FROM items WHERE id = ? FOR UPDATE', [item.itemId])
        );
        const stockResults = await Promise.all(stockChecks);

        for (let i = 0; i < itemEntries.length; i++) {
            const requested = itemEntries[i];
            const [[itemData]] = stockResults[i]; // Result is [[{name, stock}], [fieldDefs]]

            if (!itemData) {
                await connection.rollback();
                console.log(`Batch borrow failed: Item ID ${requested.itemId} not found.`);
                return res.status(400).json({ error: `Item with ID ${requested.itemId} not found.` });
            }
            if (itemData.stock < requested.quantity) {
                await connection.rollback();
                console.log(`Batch borrow failed: Insufficient stock for Item ID ${requested.itemId} (${itemData.name}). Available: ${itemData.stock}, Requested: ${requested.quantity}`);
                return res.status(400).json({ error: `Insufficient stock for ${itemData.name}. Available: ${itemData.stock}, Requested: ${requested.quantity}` });
            }
             console.log(`Stock OK for Item ID ${requested.itemId} (${itemData.name})`);
        }
        console.log('All stock checks passed.');

        // 2. If all stock checks pass, proceed with updates and inserts
        console.log('Processing updates and inserts...');
        const updatePromises = [];
        const insertPromises = [];

        for (const item of itemEntries) {
            // Decrement stock (add update promise)
            updatePromises.push(
                connection.query('UPDATE items SET stock = stock - ? WHERE id = ?', [item.quantity, item.itemId])
            );

            // Create borrow records (add insert promises - one per unit)
            // Note: A 'quantity' column in borrow_records would simplify this.
            for (let i = 0; i < item.quantity; i++) {
                insertPromises.push(
                    connection.query(
                        'INSERT INTO borrow_records (userId, itemId, status, usageLocation, occasion) VALUES (?, ?, "Borrowed", ?, ?)',
                        [userId, item.itemId, usageLocation, occasion] // Store context here
                    )
                );
            }
            // Add promise to update status if stock hits zero after decrementing
             updatePromises.push(
                connection.query('UPDATE items SET status = "Out of Stock" WHERE id = ? AND stock - ? <= 0', [item.itemId, item.quantity])
             );
        }

        console.log(`Executing ${updatePromises.length} update queries and ${insertPromises.length} insert queries.`);
        await Promise.all([...updatePromises, ...insertPromises]);
        console.log('All updates and inserts completed.');

        await connection.commit();
        console.log('Transaction committed successfully.');
        res.status(201).json({ message: `Successfully borrowed ${insertPromises.length} item(s).` });

    } catch (error) {
        console.error("!!! Critical Batch Borrow Transaction Failed:", error);
        if (connection) {
            console.log('Rolling back transaction due to error...');
            await connection.rollback();
        }
        if (!res.headersSent) {
            res.status(500).json({ error: 'A server error occurred during the borrow process.' });
        }
    } finally {
        if (connection) {
            console.log('Releasing database connection.');
            connection.release();
        }
    }
});

// PUT (return) a single item
app.put('/api/return/:recordId', async (req, res) => {
    console.log(`--- Received PUT /api/return/${req.params.recordId} ---`);
    const { recordId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
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
        console.error("Return transaction failed:", error);
         if (connection) await connection.rollback();
         if (!res.headersSent) {
            res.status(500).json({ error: 'A database error occurred during the return process.' });
         }
    } finally {
        if (connection) connection.release();
    }
});

// POST /api/return/batch (Bulk return items)
app.post('/api/return/batch', async (req, res) => {
    console.log('\n--- Received POST /api/return/batch ---', req.body);
    const { recordIds } = req.body;
    let connection;

    if (!recordIds || !Array.isArray(recordIds) || recordIds.length === 0) {
        console.log('Batch return failed: Missing or invalid recordIds array.');
        return res.status(400).json({ error: 'An array of record IDs is required.' });
    }
    const numericRecordIds = recordIds.map(Number).filter(id => !isNaN(id) && id > 0);
    if (numericRecordIds.length !== recordIds.length) {
         console.log('Batch return failed: Invalid data in recordIds array.');
         return res.status(400).json({ error: 'Invalid data provided in record IDs.' });
    }

    try {
        console.log(`Starting batch return for record IDs: ${numericRecordIds.join(', ')}`);
        connection = await pool.getConnection();
        console.log('Obtained connection. Starting transaction.');
        await connection.beginTransaction();

        const placeholders = numericRecordIds.map(() => '?').join(',');
        const verifyQuery = `SELECT id, itemId, status FROM borrow_records WHERE id IN (${placeholders}) AND status = 'Borrowed' FOR UPDATE`;
        console.log('Verifying records...');
        const [recordsToReturn] = await connection.query(verifyQuery, numericRecordIds);

        if (recordsToReturn.length !== numericRecordIds.length) {
            await connection.rollback();
            // --- FIX: Remove TypeScript type annotation : any ---
            const foundIds = recordsToReturn.map((r) => r.id);
            // --- END FIX ---
            const missingIds = numericRecordIds.filter(id => !foundIds.includes(id));
            console.log(`Batch return failed: Records not found or not in 'Borrowed' state. Missing/Invalid IDs: ${missingIds.join(', ')}`);
            return res.status(400).json({ error: `One or more records are invalid, not found, or already returned. Invalid IDs: ${missingIds.join(', ')}` });
        }
        console.log('All records verified.');

        console.log('Updating borrow records...');
        const updateRecordsQuery = `UPDATE borrow_records SET status = 'Returned', returnedDate = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`;
        await connection.query(updateRecordsQuery, numericRecordIds);
        console.log('Borrow records updated.');

        console.log('Incrementing item stocks...');
        const stockUpdatePromises = recordsToReturn.map((record) =>
            connection.query('UPDATE items SET stock = stock + 1, status = "Available" WHERE id = ?', [record.itemId])
        );
        await Promise.all(stockUpdatePromises);
        console.log('Item stocks incremented.');

        await connection.commit();
        console.log('Transaction committed successfully.');
        res.status(200).json({ message: `Successfully returned ${recordsToReturn.length} item(s).` });

    } catch (error) {
        console.error("!!! Critical Batch Return Transaction Failed:", error);
        if (connection) {
            console.log('Rolling back transaction due to error...');
            await connection.rollback();
        }
        if (!res.headersSent) {
            res.status(500).json({ error: 'A server error occurred during the return process.' });
        }
    } finally {
        if (connection) {
            console.log('Releasing database connection.');
            connection.release();
        }
    }
});


// --- START SERVER ---
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});

