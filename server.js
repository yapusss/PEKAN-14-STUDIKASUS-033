const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('./config/db');
const containerClient = require('./config/storage');
require('dotenv').config();

const app = express();
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Serve home page redirecting to submit-task UI
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'submit.html'));
});

// Endpoint: Submit Task
app.post('/submit-task', upload.single('file_tugas'), async (req, res) => {
    try {
        const { nim, name, class_name, course } = req.body;
        const file = req.file;

        if (!nim || !name || !class_name || !course || !file) {
            return res.status(400).send('<h3>Error: Semua kolom dan file tugas wajib diisi/diunggah.</h3><a href="/submit.html">Kembali</a>');
        }

        // Format nama file: NIM_Nama_tugas1.ext
        const ext = path.extname(file.originalname);
        const cleanName = name.replace(/\s+/g, '_').toLowerCase();
        const blobName = `${nim}_${cleanName}_tugas1${ext}`;

        console.log(`Mengunggah file ke Azure Storage: ${blobName}`);

        // Upload ke Azure Blob Storage
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        await blockBlobClient.uploadData(file.buffer, {
            blobHTTPHeaders: { blobContentType: file.mimetype }
        });

        const fileUrl = blockBlobClient.url;
        console.log(`File diunggah ke: ${fileUrl}`);

        // Simpan data ke MySQL dengan status 'Pending'
        // Status akan diperbarui oleh Azure Functions menjadi 'Submitted' setelah diproses
        const sql = `
            INSERT INTO submissions (nim, name, class, course, file_url, status)
            VALUES (?, ?, ?, ?, ?, 'Pending')
        `;
        await db.query(sql, [nim, name, class_name, course, fileUrl]);
        console.log(`Data NIM ${nim} disimpan ke database.`);

        // Halaman sukses sederhana yang terlihat menarik
        res.send(`
            <!DOCTYPE html>
            <html lang="id">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Pengumpulan Berhasil</title>
                <link rel="stylesheet" href="/css/style.css">
                <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
            </head>
            <body class="flex-center">
                <div class="glass-card text-center success-card">
                    <div class="success-icon">✓</div>
                    <h2>Pengumpulan Berhasil!</h2>
                    <p>Tugas Anda telah diunggah ke cloud storage.</p>
                    <div class="details-box">
                        <p><strong>NIM:</strong> ${nim}</p>
                        <p><strong>Nama:</strong> ${name}</p>
                        <p><strong>Status:</strong> <span class="badge badge-pending">Pending (Memproses...)</span></p>
                    </div>
                    <p class="note-text">Catatan: Azure Functions akan memvalidasi file Anda dan mengubah status menjadi "Submitted" beberapa saat lagi.</p>
                    <div class="btn-group">
                        <a href="/submit.html" class="btn btn-primary">Kumpulkan Lagi</a>
                        <a href="/list.html" class="btn btn-secondary">Lihat Daftar Tugas</a>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error("Error pada /submit-task:", error);
        res.status(500).send(`
            <h3>Terjadi Kesalahan Server</h3>
            <p>${error.message}</p>
            <a href="/submit.html">Kembali ke Form</a>
        `);
    }
});

// API Endpoint: Get All submissions
app.get('/api/tasks', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM submissions ORDER BY submitted_at DESC');
        res.json(rows);
    } catch (error) {
        console.error("Error pada /api/tasks:", error);
        res.status(500).json({ error: error.message });
    }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(` Server PraktikumSubmit berjalan di port ${PORT}`);
    console.log(` Buka http://localhost:${PORT} di browser Anda`);
    console.log(`===================================================`);
});
