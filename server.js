// server.js
const express = require("express");
const fs = require("fs");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const nodemailer = require("nodemailer");
const multer = require("multer");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const DB_FILE = path.join(__dirname, "db.json");
const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

// 🔹 Nodemailer (usa la tua email e password per app)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL, // sostituisci con la tua email
    pass: process.env.EMAIL_PASSWORD, // sostituisci con la password generata
  }
});

// 🔹 Multer per upload CV
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  }
});
const upload = multer({ storage });

// 🔹 Funzioni DB sicure
function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify({ prenotazioni: [] }, null, 2));
      return { prenotazioni: [] };
    }
    return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
  } catch (err) {
    console.error("Errore leggendo db.json:", err);
    return { prenotazioni: [] };
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Errore scrivendo db.json:", err);
  }
}

// 🔹 Pulisce prenotazioni passate
function cleanExpired() {
  const today = new Date().toISOString().split("T")[0];
  const db = readDB();
  db.prenotazioni = db.prenotazioni.filter(p => p.data >= today);
  writeDB(db);
}
setInterval(cleanExpired, 60 * 60 * 1000); // ogni ora

// ------------------- PRENOTAZIONI -------------------

// 📥 GET tutte le prenotazioni
app.get("/prenotazioni", (req, res) => {
  try {
    cleanExpired();
    res.json(readDB().prenotazioni);
  } catch (err) {
    console.error("Errore GET /prenotazioni:", err);
    res.status(500).json({ error: "Errore server" });
  }
});

// 📤 POST nuova prenotazione
app.post("/prenotazioni", (req, res) => {
  try {
    const { userId, nome, motivo, data, ora } = req.body;
    if (!userId || !nome || !motivo || !data || !ora)
      return res.status(400).json({ error: "Campi mancanti" });

    const db = readDB();
    const exists = db.prenotazioni.find(p => p.data === data);
    if (exists) return res.status(403).json({ error: "Giorno già prenotato" });

    const nuova = { idPrenotazione: uuidv4(), userId, nome, motivo, data, ora };
    db.prenotazioni.push(nuova);
    writeDB(db);

    console.log("📅 Nuova prenotazione:", nuova);

    // 📧 INVIO EMAIL
    const mailOptions = {
      from: process.env.EMAIL,
      to: process.env.EMAIL,
      subject: `Nuova prenotazione: ${nome} - ${data}`,
      text: `Dettagli prenotazione:
Nome: ${nome}
Motivo: ${motivo}
Giorno: ${data}
Ora: ${ora}
ID Utente: ${userId}`
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) console.error("Errore invio email:", error);
      else console.log("📧 Email inviata:", info.response);
    });

    res.json(nuova);
  } catch (err) {
    console.error("Errore POST /prenotazioni:", err);
    res.status(500).json({ error: "Errore server" });
  }
});

// ✏️ MODIFICA prenotazione (solo owner)
app.put("/prenotazioni/:id", (req, res) => {
  try {
    const { userId } = req.body;
    const db = readDB();
    const p = db.prenotazioni.find(p => p.idPrenotazione === req.params.id);
    if (!p) return res.sendStatus(404);
    if (p.userId !== userId) return res.sendStatus(403);

    Object.assign(p, req.body);
    writeDB(db);
    console.log("✏️ Prenotazione modificata:", p);
    res.json(p);
  } catch (err) {
    console.error("Errore PUT /prenotazioni/:id:", err);
    res.status(500).json({ error: "Errore server" });
  }
});

// ❌ ELIMINA prenotazione (solo owner)
app.delete("/prenotazioni/:id", (req, res) => {
  try {
    const { userId } = req.body;
    const db = readDB();
    const index = db.prenotazioni.findIndex(p => p.idPrenotazione === req.params.id);
    if (index === -1) return res.sendStatus(404);
    if (db.prenotazioni[index].userId !== userId) return res.sendStatus(403);

    const removed = db.prenotazioni.splice(index, 1)[0];
    writeDB(db);

    console.log(`❌ Prenotazione eliminata: ${removed.nome}, giorno: ${removed.data}, da utente: ${userId}`);

    // 📧 INVIO EMAIL di eliminazione
const mailOptions = {
  from: process.env.EMAIL,
  to: process.env.EMAIL,
  subject: `❌ Prenotazione eliminata: ${removed.nome} - ${removed.data}`,
  text: `
📌 Nome: ${removed.nome}
📝 Motivo: ${removed.motivo}
📅 Giorno: ${removed.data}
🕒 Ora: ${removed.ora}
👤 ID Utente: ${removed.userId}
`,
  // Forza UTF-8
  headers: {
    "Content-Type": "text/plain; charset=utf-8"
  }
};



    transporter.sendMail(mailOptions, (error, info) => {
      if (error) console.error("Errore invio email eliminazione:", error);
      else console.log("📧 Email eliminazione inviata:", info.response);
    });

    res.sendStatus(204);
  } catch (err) {
    console.error("Errore DELETE /prenotazioni/:id:", err);
    res.status(500).json({ error: "Errore server" });
  }
});

// ------------------- CANDIDATURE -------------------

// 📤 POST nuova candidatura
app.post("/candidature", upload.single("cv"), (req, res) => {
  try {
    const { nome, email, telefono, esperienze, scegliere, posizione, linkedin, competenze, disponibilità } = req.body;

    if (!nome || !email) {
      return res.status(400).json({ error: "Nome e email sono obbligatori" });
    }

    const CANDIDATURE_FILE = path.join(__dirname, "candidature.json");
    let db = { candidature: [] };
    if (fs.existsSync(CANDIDATURE_FILE)) {
      db = JSON.parse(fs.readFileSync(CANDIDATURE_FILE, "utf-8"));
    }

    const candidatura = {
      idCandidatura: uuidv4(),
      nome, email, telefono, esperienze, scegliere, posizione, linkedin, competenze, disponibilità,
      cv: req.file ? req.file.filename : null,
      data: new Date().toISOString()
    };

    db.candidature.push(candidatura);
    fs.writeFileSync(CANDIDATURE_FILE, JSON.stringify(db, null, 2));

    console.log("📄 Nuova candidatura:", candidatura);

   const mailOptions = {
  from: process.env.EMAIL,
  to: process.env.EMAIL,
  subject: `📄 Nuova candidatura: ${nome} - ${posizione || "Posizione non specificata"} ✨`,
  text: `
📌 Nome: ${nome}
📧 Email: ${email}
📱 Telefono: ${telefono || "-"}
💼 Esperienze: ${esperienze || "-"}
🌟 Perché sceglierci: ${scegliere || "-"}
📝 Posizione: ${posizione || "-"}
🔗 LinkedIn: ${linkedin || "-"}
🎯 Competenze: ${competenze || "-"}
⏰ Disponibilità: ${disponibilità || "-"}
`,
  attachments: req.file
    ? [{ path: path.join(UPLOADS_DIR, req.file.filename), filename: req.file.originalname }]
    : []
};


    transporter.sendMail(mailOptions, (err, info) => {
      if (err) console.error("Errore invio email candidatura:", err);
      else console.log("📧 Email candidatura inviata:", info.response);
    });

    res.json({ success: true, candidatura });
  } catch (err) {
    console.error("Errore POST /candidature:", err);
    res.status(500).json({ error: "Errore server" });
  }
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`✅ Server avviato sulla porta ${port}`);
});