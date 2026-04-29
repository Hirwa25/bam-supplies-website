const express = require('express');
const nodemailer = require('nodemailer');
const multer = require('multer');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    console.log('Request received:', req.method, req.url);
    next();
});

// File upload setup
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname); // ✅ cd → cb, orginalname → originalname
    }
});

const upload = multer({ storage: storage });

// Email setup
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: 'stellandayambaje4@gmail.com',
        pass: 'mjrtchlwnibcllpt'  // ✅ no spaces
    }
});

// Contact form route
app.post('/send', upload.single('attachment'), async (req, res) => {  // ✅ 'send' → '/send'
    const { name, email, subject, message } = req.body;

    const mailOptions = {
        from: email,
        to: 'stellandayambaje4@gmail.com',  // ✅ jfg.comz → jfg.co.mz
        subject: subject || 'New message from website',
        html: `
            <h3>New message from Grupo JFG website</h3>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <p><strong>Message:</strong> ${message}</p>
        `,
        attachments: req.file ? [{
            filename: req.file.originalname,  // ✅ orginalname → originalname
            path: req.file.path
        }] : []
    };

    try {
        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: 'Email sent successfully!' });  // ✅ joson → json, sucess → success
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to send email.' });  // ✅ sucess → success
    }
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});