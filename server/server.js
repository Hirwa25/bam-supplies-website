const express = require('express');
const nodemailer = require('nodemailer');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');

const app = express();
const SECRET = 'bam_secret_2026';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dashboard')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ---- File upload setup ----
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// ---- Email setup ----
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
        }
    });
// ---- Middleware to verify login ----
function authMiddleware(req, res, next) {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ success: false, message: 'Not authorized' });
    try {
        const decoded = jwt.verify(token, SECRET);
        req.user = decoded;
        next();
    } catch {
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
}

// ---- LOGIN ----
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });
    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return res.status(401).json({ success: false, message: 'Wrong password' });
    const token = jwt.sign({ id: user.id, name: user.name, role: user.role }, SECRET, { expiresIn: '8h' });
    res.json({ success: true, token, name: user.name, role: user.role });
});

// ---- GET all orders ----
app.get('/api/orders', authMiddleware, (req, res) => {
    const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
    res.json({ success: true, orders });
});

// ---- GET single order ----
app.get('/api/orders/:id', authMiddleware, (req, res) => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, order });
});

// ---- CREATE order ----
app.post('/api/orders', authMiddleware, upload.single('file'), (req, res) => {
    const { client, vessel, port, order_date, delivery_date, status, source, notes } = req.body;
    const file_path = req.file ? req.file.path : null;
    const file_name = req.file ? req.file.originalname : null;
    const insert = db.prepare(
        'INSERT INTO orders (client, vessel, port, order_date, delivery_date, status, source, notes, file_path, file_name, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const result = insert.run(client, vessel, port, order_date, delivery_date, status || 'Pending', source || 'Manual', notes, file_path, file_name, req.user.id);
    res.json({ success: true, id: result.lastInsertRowid });
});

// ---- UPDATE order ----
app.put('/api/orders/:id', authMiddleware, (req, res) => {
    const { client, vessel, port, order_date, delivery_date, status, notes } = req.body;
    db.prepare(
        'UPDATE orders SET client=?, vessel=?, port=?, order_date=?, delivery_date=?, status=?, notes=? WHERE id=?'
    ).run(client, vessel, port, order_date, delivery_date, status, notes, req.params.id);
    res.json({ success: true });
});

// ---- DELETE order (admin only) ----
app.delete('/api/orders/:id', authMiddleware, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admins only' });
    db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

// ---- GET all users (admin only) ----
app.get('/api/users', authMiddleware, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admins only' });
    const users = db.prepare('SELECT id, name, email, role, created_at FROM users').all();
    res.json({ success: true, users });
});

// ---- CREATE user (admin only) ----
app.post('/api/users', authMiddleware, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admins only' });
    const { name, email, password, role } = req.body;
    const hashed = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run(name, email, hashed, role || 'staff');
    res.json({ success: true });
});

// ---- DELETE user (admin only) ----
app.delete('/api/users/:id', authMiddleware, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admins only' });
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

// ---- Contact form ----
app.post('/send', upload.single('attachment'), async (req, res) => {
    const { name, email, subject, message } = req.body;
    const mailOptions = {
        from: email,
        to: process.env.EMAIL_USER,
        subject: subject || 'New message from website',
        html: `
            <h3>New message from BAM Supplies website</h3>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <p><strong>Message:</strong> ${message}</p>
        `,
        attachments: req.file ? [{ filename: req.file.originalname, path: req.file.path }] : []
    };
    try {
        await transporter.sendMail(mailOptions);
        // Auto register as order
        db.prepare(
            'INSERT INTO orders (client, vessel, port, order_date, delivery_date, status, source, notes, file_path, file_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(name, 'N/A', 'N/A', new Date().toISOString().split('T')[0], 'N/A', 'Pending', 'Website', message, req.file ? req.file.path : null, req.file ? req.file.originalname : null);
        res.json({ success: true, message: 'Email sent successfully!' });
    } catch (error) {
        console.error('FULL ERROR:', error.message);
        res.status(500).json({ success: false, message: 'Failed to send email.' });
    }
});

app.listen(process.env.PORT || 3000, () => {
    console.log('Server running on port 3000');
});