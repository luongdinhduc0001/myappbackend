const express = require('express');
const mariadb = require('mariadb');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Worker } = require('worker_threads');

const app = express();
const port = process.env.PORT || 5000;

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000' || 'http://127.0.0.1:3000' || 'http://171.244.140.151' || 'http://ducld12321.id.vn' || 'https://ducld12321.id.vn', 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(bodyParser.json());

// Database connection pool
const pool = mariadb.createPool({
    host: '10.4.85.102',
    user: 'dbadmin',
    password: 'Vtdc#2026',
    database: 'dbtestc642',
    connectionLimit: 5,
    connectTimeout: 30000, // 30 seconds
    acquireTimeout: 30000, // 30 seconds
    timeout: 30000, // 30 seconds
    trace: true, // Enable trace for debugging
    allowPublicKeyRetrieval: true,
    ssl: false
});

// Test database connection
async function testConnection() {
    let conn;
    try {
        conn = await pool.getConnection();
        console.log('Database connection successful');
    } catch (err) {
        console.error('Database connection failed:', err);
    } finally {
        if (conn) conn.release();
    }
}

testConnection();

// Helper function to get total count
async function getTotalCount(conn, table) {
    const result = await conn.query(`SELECT COUNT(*) as total FROM ${table}`);
    return Number(result[0].total); // Convert BigInt to Number
}

// API Routes

// Get all products with pagination
app.get('/api/products', async (req, res) => {
    let conn;
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const offset = (page - 1) * pageSize;

        conn = await pool.getConnection();
        const [rows, total] = await Promise.all([
            conn.query(`
                SELECT p.*, c.CategoryName, s.Name as SupplierName 
                FROM Products p
                LEFT JOIN Categories c ON p.CategoryID = c.CategoryID
                LEFT JOIN Suppliers s ON p.SupplierID = s.SupplierID
                LIMIT ? OFFSET ?
            `, [pageSize, offset]),
            getTotalCount(conn, 'Products')
        ]);

        res.json({
            data: convertDatesToString(rows),
            pagination: {
                total: Number(total),
                page: Number(page),
                pageSize: Number(pageSize),
                totalPages: Math.ceil(Number(total) / Number(pageSize))
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        if (conn) conn.release();
    }
});

// Get all categories with pagination
app.get('/api/categories', async (req, res) => {
    let conn;
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const offset = (page - 1) * pageSize;

        conn = await pool.getConnection();
        const [rows, total] = await Promise.all([
            conn.query('SELECT * FROM Categories LIMIT ? OFFSET ?', [pageSize, offset]),
            getTotalCount(conn, 'Categories')
        ]);

        res.json(convertBigIntToNumber({
            data: rows,
            pagination: {
                total: Number(total),
                page: Number(page),
                pageSize: Number(pageSize),
                totalPages: Math.ceil(Number(total) / Number(pageSize))
            }
        }));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        if (conn) conn.release();
    }
});

// Get all customers with pagination
app.get('/api/customers', async (req, res) => {
    let conn;
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const offset = (page - 1) * pageSize;

        conn = await pool.getConnection();
        const [rows, total] = await Promise.all([
            conn.query('SELECT * FROM Customers LIMIT ? OFFSET ?', [pageSize, offset]),
            getTotalCount(conn, 'Customers')
        ]);

        res.json({
            data: convertDatesToString(rows),
            pagination: {
                total: Number(total),
                page: Number(page),
                pageSize: Number(pageSize),
                totalPages: Math.ceil(Number(total) / Number(pageSize))
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        if (conn) conn.release();
    }
});

// Get all orders with pagination
app.get('/api/orders', async (req, res) => {
    let conn;
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const offset = (page - 1) * pageSize;

        conn = await pool.getConnection();
        const [rows, total] = await Promise.all([
            conn.query(`
                SELECT o.*, c.Name as CustomerName 
                FROM Orders o
                LEFT JOIN Customers c ON o.CustomerID = c.CustomerID
                LIMIT ? OFFSET ?
            `, [pageSize, offset]),
            getTotalCount(conn, 'Orders')
        ]);

        res.json({
            data: convertDatesToString(rows),
            pagination: {
                total: Number(total),
                page: Number(page),
                pageSize: Number(pageSize),
                totalPages: Math.ceil(Number(total) / Number(pageSize))
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        if (conn) conn.release();
    }
});

// Create new order
app.post('/api/orders', async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const { CustomerID, OrderDate, TotalAmount, items } = req.body;
        
        // Start transaction
        await conn.beginTransaction();
        
        // Insert order
        const orderResult = await conn.query(
            'INSERT INTO Orders (CustomerID, OrderDate, TotalAmount) VALUES (?, ?, ?)',
            [CustomerID, OrderDate, TotalAmount]
        );
        
        const OrderID = orderResult.insertId;
        
        // Insert order items
        for (const item of items) {
            await conn.query(
                'INSERT INTO OrderItems (OrderID, ProductID, Quantity, Price) VALUES (?, ?, ?, ?)',
                [OrderID, item.ProductID, item.Quantity, item.Price]
            );
        }
        
        await conn.commit();
        res.json({ message: 'Order created successfully', OrderID: Number(OrderID) });
    } catch (err) {
        if (conn) await conn.rollback();
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        if (conn) conn.release();
    }
});

// Thêm API thống kê cho dashboard
app.get('/api/stats', async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const [[{ totalProducts }], [{ totalOrders }], [{ totalCustomers }], [{ totalRevenue }]] = await Promise.all([
            conn.query('SELECT COUNT(*) as totalProducts FROM Products'),
            conn.query('SELECT COUNT(*) as totalOrders FROM Orders'),
            conn.query('SELECT COUNT(*) as totalCustomers FROM Customers'),
            conn.query('SELECT IFNULL(SUM(TotalAmount), 0) as totalRevenue FROM Orders')
        ]);
        res.json({
            totalProducts: Number(totalProducts),
            totalOrders: Number(totalOrders),
            totalCustomers: Number(totalCustomers),
            totalRevenue: Number(totalRevenue)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        if (conn) conn.release();
    }
});


const uploadDir = process.env.UPLOAD_DIR || '/uploads';
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// API Routes for file management
// Get list of uploaded files
app.get('/api/files', async (req, res) => {
    try {
        if (!fs.existsSync(uploadDir)) {
            return res.json([]);
        }

        const files = fs.readdirSync(uploadDir).map(filename => {
            const filePath = path.join(uploadDir, filename);
            const stats = fs.statSync(filePath);
            return {
                filename: filename,
                uploadDate: stats.mtime,
                size: stats.size
            };
        });

        res.json(files);
    } catch (err) {
        console.error('Error getting files:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Download file
app.get('/api/files/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(uploadDir, filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    res.download(filePath, filename, (err) => {
        if (err) {
            console.error('Error downloading file:', err);
            res.status(500).json({ error: 'Error downloading file' });
        }
    });
});

// Upload file
app.post('/api/upload', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        res.json({
            message: 'File uploaded successfully',
            filename: req.file.filename,
            originalname: req.file.originalname,
            size: req.file.size
        });
    } catch (err) {
        console.error('Error uploading file:', err);
        res.status(500).json({ error: 'Error uploading file' });
    }
});

// Xóa file
app.delete('/api/files/delete/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(uploadDir, filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    fs.unlink(filePath, (err) => {
        if (err) {
            console.error('Error deleting file:', err);
            return res.status(500).json({ error: 'Error deleting file' });
        }
        res.json({ message: 'File deleted successfully' });
    });
});

app.get('/api/load/cpu', (req, res) => {
    const worker = new Worker(path.join(__dirname, 'cpuLoadWorker.js'));
    worker.on('exit', () => console.log('CPU load worker exited'));
    worker.on('error', (err) => console.error('Worker error:', err));
    res.json({ message: 'CPU load started (100s)' });
});

app.get('/api/load/ram', (req, res) => {
    const worker = new Worker(path.join(__dirname, 'ramLoadWorker.js'));
    worker.on('exit', () => console.log('RAM load worker exited'));
    worker.on('error', (err) => console.error('Worker error:', err));
    res.json({ message: 'RAM load started (100s)' });
});


// Start server
app.listen(port, () => {
    console.log('database host: 10.4.85.102');
    console.log(`Server is running on port ${port}`);
});

function convertBigIntToNumber(obj) {
  if (Array.isArray(obj)) {
    return obj.map(convertBigIntToNumber);
  } else if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : convertBigIntToNumber(v)])
    );
  }
  return obj;
}

function convertDatesToString(obj) {
  if (Array.isArray(obj)) {
    return obj.map(convertDatesToString);
  } else if (obj && typeof obj === 'object') {
    // Nếu là object kiểu { year, month, day }
    if (
      Object.keys(obj).length === 3 &&
      'year' in obj && 'month' in obj && 'day' in obj &&
      typeof obj.year === 'number' && typeof obj.month === 'number' && typeof obj.day === 'number'
    ) {
      const mm = obj.month.toString().padStart(2, '0');
      const dd = obj.day.toString().padStart(2, '0');
      return `${obj.year}-${mm}-${dd}`;
    }
    if (obj instanceof Date) {
      return obj.toISOString().slice(0, 10);
    }
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, convertDatesToString(v)])
    );
  }
  return obj;
}

