const multer = require('multer');
const FormData = require('form-data');
const axios = require('axios');
const fs = require('fs');
const os = require('os');

const upload = multer({ dest: os.tmpdir() });

// Disable default body parsing for multipart
export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // Wrap multer for serverless
  await new Promise((resolve, reject) => {
    upload.single('file')(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

  try {
    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    formData.append('fileToUpload', fs.createReadStream(req.file.path), req.file.originalname);

    const response = await axios.post('https://catbox.moe/user/api.php', formData, {
      headers: formData.getHeaders(),
      maxBodyLength: Infinity,
    });

    fs.unlinkSync(req.file.path);

    const catboxUrl = response.data;
    const filename = catboxUrl.split('/').pop();

    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;

    const customUrl = `${protocol}://${host}/file/${filename}`;
    res.status(200).json({ success: true, url: customUrl });
  } catch (error) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error(error);
    res.status(500).json({ success: false, error: 'Upload failed' });
  }
}
