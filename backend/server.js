const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

dotenv.config();

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
    
    if (token == null) return res.status(401).json({ error: 'No autorizado. Inicia sesión nuevamente.' });
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Sesión expirada o inválida. Inicia sesión nuevamente.' });
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

// ---- HISTORICO DE COTIZACIONES ----
const QUOTES_FILE = path.join(__dirname, 'cotizaciones.json');

function readQuotes() {
    if (!fs.existsSync(QUOTES_FILE)) return [];
    try {
        const data = fs.readFileSync(QUOTES_FILE, 'utf8');
        return JSON.parse(data);
    } catch(e) {
        return [];
    }
}

function writeQuotes(quotes) {
    fs.writeFileSync(QUOTES_FILE, JSON.stringify(quotes, null, 2), 'utf8');
}

app.get('/api/quotes', authenticateToken, (req, res) => {
    try {
        const quotes = readQuotes();
        // Ordenar por fecha descendente
        quotes.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        res.json(quotes);
    } catch (error) {
        res.status(500).json({ error: 'Error leyendo historial' });
    }
});

app.post('/api/quotes', authenticateToken, (req, res) => {
    try {
        const newQuote = req.body;
        let quotes = readQuotes();
        
        if (newQuote.id) {
            // Actualizar existente
            const idx = quotes.findIndex(q => q.id === newQuote.id);
            if (idx >= 0) {
                quotes[idx] = { ...newQuote, updatedAt: Date.now() };
            } else {
                quotes.push({ ...newQuote, updatedAt: Date.now() });
            }
        } else {
            // Crear nueva
            newQuote.id = Date.now().toString() + Math.floor(Math.random()*1000);
            newQuote.createdAt = Date.now();
            newQuote.updatedAt = Date.now();
            quotes.push(newQuote);
        }
        
        writeQuotes(quotes);
        res.json({ success: true, id: newQuote.id });
    } catch (error) {
        res.status(500).json({ error: 'Error guardando cotización' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor de OCR (Groq) corriendo en http://localhost:${PORT}`);
    console.log('Esperando documentos para analizar...');
});

// Requerido para Vercel
module.exports = app;
