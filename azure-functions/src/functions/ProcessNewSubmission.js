const { app } = require('@azure/functions');
const mysql = require('mysql2/promise');

app.storageBlob('ProcessNewSubmission', {
    path: 'tugas-praktikum/{name}',
    connection: 'AzureWebJobsStorage',
    handler: async (blob, context) => {
        context.log(`File baru terdeteksi: ${context.triggerMetadata.name}`);
        
        const blobName = context.triggerMetadata.name; // Format penamaan: NIM_Nama_tugas1.ext
        
        // Memecah nama file untuk mencari NIM (bagian sebelum underscore pertama)
        const parts = blobName.split('_');
        if (parts.length < 2) {
            context.log(`Format nama file '${blobName}' tidak sesuai. Minimal mengandung satu karakter underscore (NIM_Nama_tugas1.ext)`);
            return;
        }
        
        const nim = parts[0];
        context.log(`Mencari data pengumpulan untuk NIM: ${nim}`);

        // Buat koneksi ke database MySQL
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            ssl: { rejectUnauthorized: false }
        });

        try {
            // Update status dari 'Pending' menjadi 'Submitted'
            const sql = "UPDATE submissions SET status = 'Submitted' WHERE nim = ? AND status = 'Pending'";
            const [result] = await connection.execute(sql, [nim]);
            
            if (result.affectedRows > 0) {
                context.log(`SUCCESS: Status pengumpulan mahasiswa NIM ${nim} berhasil diubah ke 'Submitted'.`);
            } else {
                context.log(`WARNING: Tidak ditemukan data submissions berstatus 'Pending' untuk NIM ${nim}.`);
            }
        } catch (err) {
            context.error(`DATABASE ERROR: ${err.message}`);
        } finally {
            await connection.end();
            context.log('Koneksi database ditutup.');
        }
    }
});
