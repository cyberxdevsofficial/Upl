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

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 1. Upload API (ෆයිල් එක අප්ලෝඩ් කරන කොටස)
app.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

    try {
        const formData = new FormData();
        formData.append('reqtype', 'fileupload');
        
        // 🔴 මෙතන තමයි වෙනස කළේ: ෆයිල් එකේ මුල් නමත් එක්කම (Original Name) Catbox එකට යවනවා
        formData.append('fileToUpload', fs.createReadStream(req.file.path), req.file.originalname);

        const response = await axios.post('https://catbox.moe/user/api.php', formData, {
            headers: formData.getHeaders(),
            maxBodyLength: Infinity 
        });

        fs.unlinkSync(req.file.path);

        const catboxUrl = response.data;
        const filename = catboxUrl.split('/').pop();

        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        
        // කෙලින්ම ෆයිල් එකේ ලින්ක් එක දෙනවා
        const customRaviyaUrl = `${protocol}://${host}/file/${filename}`;
        res.json({ success: true, url: customRaviyaUrl });
        
    } catch (error) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, error: 'Upload failed' });
    }
});

// 2. Direct Media View (ෆොටෝ/වීඩියෝ එක කෙලින්ම පෙන්නන තැන)
app.get('/file/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        const catboxUrl = `https://files.catbox.moe/${filename}`;
        
        const response = await axios({
            method: 'get',
            url: catboxUrl,
            responseType: 'stream'
        });

        let contentType = response.headers['content-type'] || 'application/octet-stream';

        // Extension එක බලලා හරියටම Content-Type එක හදනවා 
        if (filename.includes('.')) {
            const ext = filename.split('.').pop().toLowerCase();
            if (['jpg', 'jpeg'].includes(ext)) contentType = 'image/jpeg';
            else if (ext === 'png') contentType = 'image/png';
            else if (ext === 'gif') contentType = 'image/gif';
            else if (ext === 'webp') contentType = 'image/webp';
            else if (ext === 'mp4') contentType = 'video/mp4';
            else if (['mp3', 'm4a'].includes(ext)) contentType = 'audio/mpeg';
        }

        res.setHeader('Content-Type', contentType);
        
        // ඩවුන්ලෝඩ් නොවී Browser එකේම Preview වෙන්න හදනවා (inline)
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

        response.data.pipe(res);
        
    } catch (error) {
        res.status(404).send('❌ File not found!');
    }
});

module.exports = app;

if (require.main === module) {
    app.listen(port, () => {
        console.log(`🚀 Anuga Uploader running on port ${port}`);
    });
                                          }
