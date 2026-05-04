const express = require("express");
const fs = require("fs");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);
const multer = require("multer");

const app = express();

// ---------------- MIDDLEWARE ----------------
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------------- FILE PATH ----------------
const DB_FILE = path.join(__dirname, "db.json");
const UPLOADS_DIR = path.join(__dirname, "uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

// ---------------- EMAIL ----------------


// ---------------- MULTER ----------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  }
});

const upload = multer({ storage });

// ---------------- DB FUNCTIONS ----------------
function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ prenotazioni: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ---------------- CLEAN OLD ----------------
function cleanExpired() {
  const today = new Date().toISOString().split("T")[0];
  const db = readDB();
  db.prenotazioni = db.prenotazioni.filter(p => p.data >= today);
  writeDB(db);
}
setInterval(cleanExpired, 60 * 60 * 1000);

// ---------------- ROUTES ----------------

// GET prenotazioni
app.get("/prenotazioni", (req, res) => {
  try {
    cleanExpired();
    res.json(readDB().prenotazioni);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore server" });
  }
});

// POST prenotazione
app.post("/prenotazioni", async (req, res) => {
  try {
    const { userId, nome, motivo, data, ora } = req.body;

    if (!userId || !nome || !motivo || !data || !ora) {
      return res.status(400).json({ error: "Campi mancanti" });
    }

    const db = readDB();

    const exists = db.prenotazioni.find(p => p.data === data);
    if (exists) {
      return res.status(403).json({ error: "Giorno già prenotato" });
    }

    const nuova = {
      idPrenotazione: uuidv4(),
      userId,
      nome,
      motivo,
      data,
      ora
    };

    db.prenotazioni.push(nuova);
    writeDB(db);

    console.log("📅 Nuova prenotazione:", nuova);

    // 📧 EMAIL CON RESEND
    try {
      await resend.emails.send({
        from: "onboarding@resend.dev",
        to: process.env.EMAIL,
        subject: `Nuova prenotazione: ${nome} - ${data}`,
        text: `
Nome: ${nome}
Motivo: ${motivo}
Data: ${data}
Ora: ${ora}
        `
      });

      console.log("📧 Email inviata (Resend)");
    } catch (error) {
      console.error("❌ Errore email:", error);
    }

    // 🔥 RISPOSTA AL CLIENT (IMPORTANTISSIMA)
    res.json(nuova);

  } catch (err) {
    console.error("Errore POST prenotazioni:", err);
    res.status(500).json({ error: "Errore server" });
  }
});
// PUT prenotazione
app.put("/prenotazioni/:id", (req, res) => {
  try {
    const { userId } = req.body;
    const db = readDB();

    const p = db.prenotazioni.find(p => p.idPrenotazione === req.params.id);
    if (!p) return res.sendStatus(404);
    if (p.userId !== userId) return res.sendStatus(403);

    Object.assign(p, req.body);
    writeDB(db);

    console.log("✏️ Modificata:", p);
    res.json(p);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore server" });
  }
});

// DELETE prenotazione
app.delete("/prenotazioni/:id", async (req, res) => {
  try {
    const { userId } = req.body;
    const db = readDB();

    const index = db.prenotazioni.findIndex(
      p => p.idPrenotazione === req.params.id
    );

    if (index === -1) return res.sendStatus(404);
    if (db.prenotazioni[index].userId !== userId) return res.sendStatus(403);

    const removed = db.prenotazioni.splice(index, 1)[0];
    writeDB(db);

    console.log(
      `❌ Prenotazione eliminata: ${removed.nome}, giorno: ${removed.data}`
    );

    // 📧 EMAIL CON RESEND
    try {
      await resend.emails.send({
        from: "onboarding@resend.dev",
        to: process.env.EMAIL,
        subject: `❌ Prenotazione eliminata: ${removed.nome}`,
        text: `
Nome: ${removed.nome}
Motivo: ${removed.motivo}
Data: ${removed.data}
Ora: ${removed.ora}
        `
      });

      console.log("📧 Email eliminazione inviata");
    } catch (error) {
      console.error("❌ Errore email eliminazione:", error);
    }

    res.sendStatus(204);

  } catch (err) {
    console.error("Errore DELETE prenotazioni:", err);
    res.status(500).json({ error: "Errore server" });
  }
});

// ---------------- CANDIDATURE ----------------
app.post("/candidature", upload.single("cv"), async (req, res) => {
  try {
    const {
      nome,
      email,
      telefono,
      esperienze,
      scegliere,
      posizione,
      linkedin,
      competenze,
      disponibilita
    } = req.body;

    if (!nome || !email) {
      return res.status(400).json({ error: "Nome e email obbligatori" });
    }

    const CANDIDATURE_FILE = path.join(__dirname, "candidature.json");

    let db = { candidature: [] };
    if (fs.existsSync(CANDIDATURE_FILE)) {
      db = JSON.parse(fs.readFileSync(CANDIDATURE_FILE, "utf-8"));
    }

    const candidatura = {
      idCandidatura: uuidv4(),
      nome,
      email,
      telefono,
      esperienze,
      scegliere,
      posizione,
      linkedin,
      competenze,
      disponibilita,
      cv: req.file ? req.file.filename : null,
      data: new Date().toISOString()
    };

    db.candidature.push(candidatura);
    fs.writeFileSync(CANDIDATURE_FILE, JSON.stringify(db, null, 2));

    console.log("📄 Nuova candidatura:", candidatura);

    // 📧 EMAIL CON RESEND
    try {
const fileBuffer = req.file
  ? fs.readFileSync(path.join(UPLOADS_DIR, req.file.filename))
  : null;

await resend.emails.send({
  from: "onboarding@resend.dev",
  to: process.env.EMAIL,
  subject: `📄 Nuova candidatura: ${nome}`,
  text: `
Nome: ${nome}
Email: ${email}
Telefono: ${telefono || "-"}
Posizione: ${posizione || "-"}
Competenze: ${competenze || "-"}
  `,
  attachments: req.file
    ? [
        {
          filename: req.file.originalname,
          content: fileBuffer.toString("base64")
        }
      ]
    : []
});

      console.log("📧 Email candidatura inviata");
    } catch (error) {
      console.error("❌ Errore email candidatura:", error);
    }

    // 🔥 LOG SUCCESSO
    console.log("✅ Candidatura inviata con successo");

    // 🔥 RISPOSTA AL CLIENT
    res.json({ success: true });

  } catch (err) {
    console.error("Errore POST candidature:", err);
    res.status(500).json({ error: "Errore server" });
  }
});

// ---------------- START SERVER ----------------
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`✅ Server avviato su porta ${port}`);
});