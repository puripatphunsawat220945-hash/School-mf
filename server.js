const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' })); 

app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database('./student_data.sqlite', (err) => {
    if (err) console.error('Error connecting to SQLite:', err);
    else console.log('Connected to SQLite database.');
});

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS app_state (key TEXT UNIQUE, value TEXT)");
});

// API บันทึกข้อมูล โดยใช้อีเมลแนบไปกับ Key
app.post('/api/save', (req, res) => {
    const { email, key, value } = req.body;
    if (!email || !key) return res.status(400).json({ error: 'Missing email or key' });

    const dbKey = `${email}:${key}`; 
    const valueString = JSON.stringify(value);

    const query = `
        INSERT INTO app_state (key, value) VALUES (?, ?) 
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `;
    
    db.run(query, [dbKey, valueString], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// API โหลดข้อมูล ดึงเฉพาะข้อมูลของอีเมลที่ส่งมา
app.get('/api/load', (req, res) => {
    const email = req.query.email;
    if (!email) return res.json({}); 

    const prefix = `${email}:%`;
    db.all("SELECT key, value FROM app_state WHERE key LIKE ?", [prefix], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        let stateData = {};
        rows.forEach(row => {
            try {
                // ตัดส่วนอีเมลออกเพื่อส่ง key กลับไปให้เว็บใช้ได้เหมือนเดิม
                const originalKey = row.key.split(':')[1];
                stateData[originalKey] = JSON.parse(row.value);
            } catch (e) {
                console.error("JSON parse error for key:", row.key);
            }
        });
        res.json(stateData);
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});