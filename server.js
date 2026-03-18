const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Ensure upload folder exists
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

// Load or init passwords JSON
const PASSWORD_FILE = path.join(__dirname, 'passwords.json');
let passwords = {};
if (fs.existsSync(PASSWORD_FILE)) {
    passwords = JSON.parse(fs.readFileSync(PASSWORD_FILE));
}

// Multer setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Serve frontend
app.use(express.static(__dirname));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Upload endpoint
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

    // Optional password
    const password = req.body.password?.trim();
    if (password) {
        passwords[req.file.filename] = password;
        fs.writeFileSync(PASSWORD_FILE, JSON.stringify(passwords, null, 2));
    }

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const fileUrl = `${protocol}://${host}/file/${req.file.filename}`;

    res.json({ success: true, url: fileUrl });
});

// File access route with password check
app.get('/file/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(UPLOAD_DIR, filename);

    if (!fs.existsSync(filePath)) return res.status(404).send('❌ File not found!');

    const password = passwords[filename];
    if (password) {
        const inputPassword = req.query.p;
        if (!inputPassword || inputPassword !== password) {
            return res.status(401).send(`
                <html>
                <body style="font-family:sans-serif;text-align:center;margin-top:100px;">
                    <form method="GET">
                        <p>This file is password protected</p>
                        <input type="password" name="p" placeholder="Enter password"/>
                        <button type="submit">Unlock</button>
                    </form>
                </body>
                </html>
            `);
        }
    }

    res.sendFile(filePath);
});

// Start server
app.listen(port, () => {
    console.log(`🚀 Self-hosted uploader running on port ${port}`);
});
