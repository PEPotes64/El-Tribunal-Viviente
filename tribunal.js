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
        GatewayIntentBits.MessageContent // 👈 Permiso para leer chat
    ]
});

// Inicialización de Groq
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ==========================================
// 3. IMPRIMIR MODELOS DISPONIBLES EN GROQ 🔍
// ==========================================
async function verModelosGroq() {
    try {
        const lista = await groq.models.list();
        console.log("📋 MODELOS DISPONIBLES EN TU CUENTA DE GROQ:");
        lista.data.forEach(m => console.log(` - ID: "${m.id}"`));
    } catch (e) {
        console.error("❌ Error al consultar modelos de Groq:", e);
    }
}

// Se ejecuta DESPUÉS de inicializar 'groq'
verModelosGroq();

// ==========================================
// 4. EVENTO DE INICIO (READY)
// ==========================================
client.once('clientReady', (c) => {
    console.log(`⚖️ EL TRIBUNAL VIVIENTE conectado y listo como ${c.user.tag}`);
});

// ==========================================
// 5. LÓGICA DE MONITOREO Y MODERACIÓN CON IA
// ==========================================
client.on('messageCreate', async (message) => {
    // Ignorar bots o mensajes privados
    if (message.author.bot || !message.guild) return;

    // Log de lectura en tiempo real
    console.log(`📩 [${message.guild.name}] ${message.author.tag}: "${message.content}"`);

    try {
        const completion = await groq.chat.completions.create({
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
                {
                    role: "user",
                    content: message.content
                }
            ],
            // Si te vuelve a dar error de modelo, cambiá este valor por uno de los que imprima 'verModelosGroq' en la consola
            model: "llama-3.1-8b-instant",
            response_format: { type: "json_object" }
        });

        const respuestaIA = JSON.parse(completion.choices[0]?.message?.content || '{}');
        console.log(`🤖 Evaluación Groq:`, respuestaIA);

        if (respuestaIA.toxic) {
            console.log(`🚨 INFRACCIÓN DETECTADA por ${message.author.tag}. Acción: ${respuestaIA.accion}`);

            // 1. Borrar mensaje si aplica
            if (['BORRAR', 'TIMEOUT', 'BAN'].includes(respuestaIA.accion)) {
                if (message.deletable) {
                    await message.delete();
                    console.log(`🗑️ Mensaje de ${message.author.tag} eliminado.`);
                }
            }

            // 2. Aplicar sanción a miembro
            const member = await message.guild.members.fetch(message.author.id);

            if (respuestaIA.accion === 'TIMEOUT') {
                if (member.moderatable) {
                    await member.timeout(10 * 60 * 1000, respuestaIA.razon); // 10 mins
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
// 6. LOGIN EN DISCORD
// ==========================================
client.login(process.env.DISCORD_TOKEN);
