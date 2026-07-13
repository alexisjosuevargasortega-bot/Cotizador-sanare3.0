const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc } = require('firebase/firestore');

dotenv.config();

// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAX1AA7tTnlnApVZlnnuMkB42k3W5IlwoM",
  authDomain: "sanare-cotizador.firebaseapp.com",
  projectId: "sanare-cotizador",
  storageBucket: "sanare-cotizador.firebasestorage.app",
  messagingSenderId: "902613920907",
  appId: "1:902613920907:web:0e73bd5def3cf4396a788e"
};
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Secret key para los JWT
const JWT_SECRET = process.env.JWT_SECRET || 'SanareSuperSecretKey2026';

// Usuarios válidos
const validUsers = {
    'admin': 'g84k$2H*9Xl!',
    'quimico': 'juvkSxrq?2@2',
    'BI': 'fdSB%P174bnz'
};

// Middleware para verificar token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token == null) return res.sendStatus(401);
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// Ruta de Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (validUsers[username] && validUsers[username] === password) {
        const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '12h' });
        res.json({ token });
    } else {
        res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }
});

// ---- SERVIR FRONTEND ESTATICO ----
// Sirve la carpeta 'cotizador_premium' en la raíz (/)
app.use(express.static(path.join(__dirname, '../cotizador_premium')));

app.post('/api/extract', authenticateToken, async (req, res) => {
    try {
        const { imageBase64 } = req.body;

        if (!imageBase64) {
            return res.status(400).json({ error: 'No se envió ninguna imagen.' });
        }

        if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'pon_tu_clave_aqui') {
             return res.status(500).json({ error: 'La API Key de Groq no está configurada en el archivo .env del backend.' });
        }

        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

        const prompt = `Eres un asistente médico experto. Revisa la imagen adjunta, la cual es una indicación médica o receta (puede estar escrita a mano o en computadora). 
Tu tarea es extraer la siguiente información en formato JSON estrictamente:
- "paciente": Nombre completo del paciente (si se menciona). Si no, null.
- "medico": Nombre completo del médico tratante (si se menciona). Si no, null.
- "diagnostico": Diagnóstico o comentarios médicos mencionados. Si no, null.
- "medicamentos": Una lista de objetos, donde cada objeto tiene:
    - "nombre": El nombre del medicamento o servicio (trata de extraer el nombre genérico o de patente más claro posible).
    - "cantidad": La cantidad o número de ciclos/cajas solicitadas (solo el número entero). Si no se especifica, asume 1.

No agregues markdown de bloques de código como \`\`\`json, solo devuelve el objeto JSON crudo sin nada más.`;

        console.log(`Procesando imagen con Groq Vision API...`);
        
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:image/jpeg;base64,${imageBase64}`
                            }
                        }
                    ]
                }
            ],
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            temperature: 0.1,
            max_tokens: 1024
        });

        let jsonText = chatCompletion.choices[0]?.message?.content || "";
        
        // Limpiar en caso de que Groq devuelva backticks
        jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const data = JSON.parse(jsonText);
        console.log('Extracción exitosa:', data);
        res.json(data);

    } catch (error) {
        console.error('Error procesando el documento:', error);
        res.status(500).json({ error: 'Error procesando el documento con la IA.', details: error.message });
    }
});

// ---- HISTORICO DE COTIZACIONES (FIRESTORE) ----
app.get('/api/quotes', authenticateToken, async (req, res) => {
    try {
        const quotesSnapshot = await getDocs(collection(db, 'cotizaciones'));
        const quotes = [];
        quotesSnapshot.forEach((doc) => {
            quotes.push(doc.data());
        });
        // Ordenar por fecha descendente
        quotes.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        res.json(quotes);
    } catch (error) {
        console.error("Error leyendo historial de Firebase:", error);
        res.status(500).json({ error: 'Error leyendo historial', details: error.message });
    }
});

app.post('/api/quotes', authenticateToken, async (req, res) => {
    try {
        const newQuote = req.body;
        
        if (!newQuote.id) {
            newQuote.id = Date.now().toString() + Math.floor(Math.random()*1000);
            newQuote.createdAt = Date.now();
        }
        newQuote.updatedAt = Date.now();
        
        // Guardar o actualizar en Firestore usando el ID como identificador del documento
        const docRef = doc(db, 'cotizaciones', newQuote.id);
        await setDoc(docRef, newQuote);
        
        res.json({ success: true, id: newQuote.id });
    } catch (error) {
        console.error("Error guardando en Firebase:", error);
        res.status(500).json({ error: 'Error guardando cotización', details: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor de OCR (Groq) corriendo en http://localhost:${PORT}`);
    console.log('Esperando documentos para analizar...');
});

// Requerido para Vercel
module.exports = app;
