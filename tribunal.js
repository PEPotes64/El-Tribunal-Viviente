// ==========================================
// 1. TRAMPA DE PUERTO PARA RENDER 🚀
// ==========================================
const http = require('http');
const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('El Tribunal Viviente esta patrullando en silencio Pepo :v');
}).listen(PORT, () => {
    console.log(`🔥 Trampa de puerto escuchando en el puerto ${PORT}`);
});

// ==========================================
// 2. IMPORTACIONES Y CONFIGURACIÓN DISCORD/GROQ
// ==========================================
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const Groq = require('groq-sdk');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Modelo para texto puro
let MODELO_TEXTO = "openai/gpt-oss-20b";
// Modelo para vision de imagenes (+18 / NSFW / Gore)
let MODELO_VISION = "llama-3.2-11b-vision-instruct";

// ==========================================
// 3. FUNCIÓN DE EVALUACIÓN MULTIMODAL (TEXTO + FOTOS) 👁️
// ==========================================
async function evaluarConIA(message) {
    const texto = message.content ? message.content.trim() : "";
    const imagenUrl = message.attachments.first()?.url;

    // Si no hay ni texto ni foto, ignorar d una
    if (!texto && !imagenUrl) {
        return null;
    }

    const promptSistema = `Eres "El Tribunal Viviente", un moderador algorítmico implacable e imparcial para Discord.
Analiza el mensaje y/o la imagen adjunta. Detecta si hay:
- Insultos graves, acoso, spam extremo, amenazas o doxxing.
- Contenido pornográfico, +18, NSFW, desnudez, sangriento o gore en la imagen.

Debes responder ÚNICAMENTE en formato JSON estricto con esta estructura exacta:
{
    "toxic": true o false,
    "accion": "NINGUNA", "BORRAR", "TIMEOUT", o "BAN",
    "razon": "Explicación corta de la sanción"
}`;

    // Construir contenido del usuario
    let contenidoUsuario = [];
    
    if (texto) {
        contenidoUsuario.push({ type: "text", text: `Texto del mensaje: "${texto}"` });
    }

    if (imagenUrl) {
        contenidoUsuario.push({ type: "image_url", image_url: { url: imagenUrl } });
        contenidoUsuario.push({ type: "text", text: "Analiza la imagen adjunta en busca de desnudez, pornografía, contenido +18 o violencia explícita." });
    }

    // Seleccionar modelo segun si hay imagen o no
    let modeloUsar = imagenUrl ? MODELO_VISION : MODELO_TEXTO;

    try {
        return await groq.chat.completions.create({
            messages: [
                { role: "system", content: promptSistema },
                { role: "user", content: contenidoUsuario }
            ],
            model: modeloUsar,
            response_format: { type: "json_object" }
        });
    } catch (err) {
        // 🔄 AUTO-FALLBACK SI FALLA EL MODELO
        if (err.status === 404 || err.code === 'model_not_found' || (err.message && err.message.includes('does not exist'))) {
            console.log(`⚠️ Modelo "${modeloUsar}" no disponible. Buscando reemplazo en Groq...`);
            
            const lista = await groq.models.list();
            
            // Si habia imagen buscar uno con 'vision', si no uno normal
            let modeloNuevo;
            if (imagenUrl) {
                modeloNuevo = lista.data.find(m => m.id.includes('vision')) || lista.data[0];
            } else {
                modeloNuevo = lista.data.find(m => m.id.includes('gpt-oss') || m.id.includes('qwen') || m.id.includes('llama')) || lista.data[0];
            }

            if (modeloNuevo) {
                if (imagenUrl) MODELO_VISION = modeloNuevo.id;
                else MODELO_TEXTO = modeloNuevo.id;
                
                console.log(`✅ ¡Auto-cambiado a "${modeloNuevo.id}"! Reintentando...`);
                
                return await groq.chat.completions.create({
                    messages: [
                        { role: "system", content: promptSistema },
                        { role: "user", content: contenidoUsuario }
                    ],
                    model: modeloNuevo.id,
                    response_format: { type: "json_object" }
                });
            }
        }
        throw err;
    }
}

// ==========================================
// 4. EVENTO DE INICIO (READY)
// ==========================================
client.once('clientReady', (c) => {
    console.log(`⚖️ EL TRIBUNAL VIVIENTE conectado y listo como ${c.user.tag}`);
    console.log(`🤖 Modelo Texto: "${MODELO_TEXTO}" | Modelo Visión: "${MODELO_VISION}"`);
});

// ==========================================
// 5. LÓGICA DE MONITOREO Y MODERACIÓN
// ==========================================
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const tieneFoto = message.attachments.size > 0 ? " [Con imagen 🖼️]" : "";
    console.log(`📩 [${message.guild.name}] ${message.author.tag}: "${message.content}"${tieneFoto}`);

    try {
        const completion = await evaluarConIA(message);
        if (!completion) return;

        const respuestaIA = JSON.parse(completion.choices[0]?.message?.content || '{}');
        console.log(`🤖 Evaluación Groq:`, respuestaIA);

        if (respuestaIA.toxic) {
            console.log(`🚨 INFRACCIÓN DETECTADA por ${message.author.tag}. Acción: ${respuestaIA.accion}`);

            // 1. Borrar mensaje
            if (['BORRAR', 'TIMEOUT', 'BAN'].includes(respuestaIA.accion)) {
                if (message.deletable) {
                    await message.delete();
                    console.log(`🗑️ Mensaje/Foto de ${message.author.tag} eliminado.`);
                }
            }

            // 2. Aplicar sanciones
            const member = await message.guild.members.fetch(message.author.id);

            if (respuestaIA.accion === 'TIMEOUT') {
                if (member.moderatable) {
                    await member.timeout(10 * 60 * 1000, respuestaIA.razon);
                    console.log(`🔇 ${message.author.tag} silenciado por 10 minutos.`);
                } else {
                    console.log(`⚠️ No se pudo silenciar a ${message.author.tag} por jerarquía de roles / permisos.`);
                }
            } else if (respuestaIA.accion === 'BAN') {
                if (member.bannable) {
                    await member.ban({ reason: respuestaIA.razon });
                    console.log(`🔨 ${message.author.tag} fue baneado del servidor.`);
                } else {
                    console.log(`⚠️ No se pudo banear a ${message.author.tag} por jerarquía de roles / permisos.`);
                }
            }
        }

    } catch (err) {
        console.error("❌ Error al procesar mensaje en El Tribunal Viviente:", err);
    }
});

// ==========================================
// 6. LOGIN
// ==========================================
client.login(process.env.DISCORD_TOKEN);
