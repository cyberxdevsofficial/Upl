const express = require('express');
const multer = require('multer');
const FormData = require('form-data');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const port = process.env.PORT || 3000;

const upload = multer({ dest: os.tmpdir() });
const passwords = {}; // filename => password

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Upload route
app.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

    try {
        const formData = new FormData();
        formData.append('reqtype', 'fileupload');
        formData.append('fileToUpload', fs.createReadStream(req.file.path), req.file.originalname);

        const response = await axios.post('https://catbox.moe/user/api.php', formData, {
            headers: formData.getHeaders(),
            maxBodyLength: Infinity
        });

        fs.unlinkSync(req.file.path);

        const catboxUrl = response.data;
        const filename = catboxUrl.split('/').pop();

        // Optional password
        if(req.body.password && req.body.password.trim()!==''){
            passwords[filename] = req.body.password.trim();
        }

        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        const customUrl = `${protocol}://${host}/file/${filename}`;

        res.json({ success: true, url: customUrl });
    } catch (error) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, error: 'Upload failed' });
    }
});

// File route with optional password check
app.get('/file/:filename', async (req, res) => {
    const filename = req.params.filename;

    if(passwords[filename]){
        const inputPassword = req.query.p;
        if(!inputPassword || inputPassword !== passwords[filename]){
            return res.status(401).send(`
                <html><body style="font-family:sans-serif;text-align:center;margin-top:100px;">
                <form method="GET">
                    <p>This file is password protected</p>
                    <input type="password" name="p" placeholder="Enter password"/>
                    <button type="submit">Unlock</button>
                </form>
                </body></html>
            `);
        }
    }

    try {
        const catboxUrl = `https://files.catbox.moe/${filename}`;
        const response = await axios({ method:'get', url:catboxUrl, responseType:'stream' });
        res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        response.data.pipe(res);
    } catch(err){
        res.status(404).send('❌ File not found!');
    }
});

app.listen(port, () => {
    console.log(`🚀 Anuga Uploader running`);
});
