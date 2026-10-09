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

// Modelo inicial preferido
let MODELO_ACTUAL = "openai/gpt-oss-20b";

// ==========================================
// 3. FUNCIÓN DE EVALUACIÓN CON SELECCIÓN AUTOMÁTICA 🤖
// ==========================================
async function evaluarConIA(texto) {
    try {
        return await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `Eres "El Tribunal Viviente", un moderador algorítmico implacable e imparcial para un servidor de Discord.
Analiza el mensaje del usuario y determina si viola las normas (insultos graves, acoso, spam extremo, contenido prohibido o toxicidad desmedida).
Debes responder ÚNICAMENTE en formato JSON estricto con esta estructura exacta:
{
    "toxic": true o false,
    "accion": "NINGUNA", "BORRAR", "TIMEOUT", o "BAN",
    "razon": "Explicación corta de la sanción"
}`
                },
                { role: "user", content: texto }
            ],
            model: MODELO_ACTUAL,
            response_format: { type: "json_object" }
        });
    } catch (err) {
        // 🔄 Si el modelo falla por 404 o nombre invalido, AUTO-ELEGIR uno valido
        if (err.status === 404 || err.code === 'model_not_found' || (err.message && err.message.includes('does not exist'))) {
            console.log(`⚠️ El modelo "${MODELO_ACTUAL}" no esta disponible. Buscando modelo automatico en tu cuenta de Groq...`);
            
            const lista = await groq.models.list();
            // Filtrar un modelo d texto compatible d la lista
            const modeloNuevo = lista.data.find(m => 
                m.id.includes('gpt-oss') || 
                m.id.includes('qwen') || 
                m.id.includes('llama') || 
                m.id.includes('mixtral')
            ) || lista.data[0];

            if (modeloNuevo) {
                MODELO_ACTUAL = modeloNuevo.id;
                console.log(`✅ ¡Modelo auto-cambiado a "${MODELO_ACTUAL}"! Reintentando evaluacion en caliente...`);
                
                // Reintentar con el nuevo modelo encontrado
                return await groq.chat.completions.create({
                    messages: [
                        {
                            role: "system",
                            content: `Eres "El Tribunal Viviente", un moderador algorítmico implacable.
Debes responder ÚNICAMENTE en formato JSON estricto con esta estructura exacta:
{
    "toxic": true o false,
    "accion": "NINGUNA", "BORRAR", "TIMEOUT", o "BAN",
    "razon": "Explicación corta de la sanción"
}`
                        },
                        { role: "user", content: texto }
                    ],
                    model: MODELO_ACTUAL,
                    response_format: { type: "json_object" }
                });
            }
        }
        throw err; // Si es otro error, lanzarlo
    }
}

// ==========================================
// 4. EVENTO DE INICIO (READY)
// ==========================================
client.once('clientReady', (c) => {
    console.log(`⚖️ EL TRIBUNAL VIVIENTE conectado y listo como ${c.user.tag}`);
    console.log(`🤖 Modelo inicial asignado: "${MODELO_ACTUAL}"`);
});

// ==========================================
// 5. LÓGICA DE MONITOREO Y MODERACIÓN
// ==========================================
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    console.log(`📩 [${message.guild.name}] ${message.author.tag}: "${message.content}"`);

    try {
        const completion = await evaluarConIA(message.content);
        const respuestaIA = JSON.parse(completion.choices[0]?.message?.content || '{}');
        
        console.log(`🤖 Evaluación Groq (${MODELO_ACTUAL}):`, respuestaIA);

        if (respuestaIA.toxic) {
            console.log(`🚨 INFRACCIÓN DETECTADA por ${message.author.tag}. Acción: ${respuestaIA.accion}`);

            // 1. Borrar mensaje
            if (['BORRAR', 'TIMEOUT', 'BAN'].includes(respuestaIA.accion)) {
                if (message.deletable) {
                    await message.delete();
                    console.log(`🗑️ Mensaje de ${message.author.tag} eliminado.`);
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
