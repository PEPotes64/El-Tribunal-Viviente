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
const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
const Groq = require('groq-sdk');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent // 👈 Obligatorio para leer el texto
    ]
});

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ==========================================
// 3. EVENTO DE INICIO (READY)
// ==========================================
client.once('clientReady', (c) => {
    console.log(`⚖️ EL TRIBUNAL VIVIENTE conectado y listo como ${c.user.tag}`);
});

// ==========================================
// 4. LÓGICA DE MONITOREO Y MODERACIÓN CON IA
// ==========================================
client.on('messageCreate', async (message) => {
    // Ignorar mensajes de bots (incluyendo a sí mismo) o mensajes fuera de servidores
    if (message.author.bot || !message.guild) return;

    // Print en vivo para ver en Render que se está leyendo el chat
    console.log(`📩 [${message.guild.name}] ${message.author.tag}: "${message.content}"`);

    try {
        // Enviar el mensaje a la IA Groq para evaluar toxicidad
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
            model: "llama-3.3-70b-versatile",
            response_format: { type: "json_object" }
        });

        const respuestaIA = JSON.parse(completion.choices[0]?.message?.content || '{}');
        console.log(`🤖 Evaluación Groq:`, respuestaIA);

        if (respuestaIA.toxic) {
            console.log(`🚨 INFRACCIÓN DETECTADA por ${message.author.tag}. Acción: ${respuestaIA.accion}`);

            // 1. Borrar mensaje si corresponde
            if (respuestaIA.accion === 'BORRAR' || respuestaIA.accion === 'TIMEOUT' || respuestaIA.accion === 'BAN') {
                if (message.deletable) {
                    await message.delete();
                    console.log(`🗑️ Mensaje de ${message.author.tag} eliminado.`);
                }
            }

            // 2. Aplicar sanciones más fuertes
            const member = await message.guild.members.fetch(message.author.id);

            if (respuestaIA.accion === 'TIMEOUT') {
                if (member.moderatable) {
                    await member.timeout(10 * 60 * 1000, respuestaIA.razon); // 10 minutos de Mute
                    console.log(`🔇 ${message.author.tag} silenciado por 10 minutos.`);
                } else {
                    console.log(`⚠️ No se pudo silenciar a ${message.author.tag} por jerarquía d roles / permisos.`);
                }
            } else if (respuestaIA.accion === 'BAN') {
                if (member.bannable) {
                    await member.ban({ reason: respuestaIA.razon });
                    console.log(`🔨 ${message.author.tag} fue baneado del servidor.`);
                } else {
                    console.log(`⚠️ No se pudo banear a ${message.author.tag} por jerarquía d roles / permisos.`);
                }
            }
        }

    } catch (err) {
        console.error("❌ Error al procesar mensaje en El Tribunal Viviente:", err);
    }
});

// ==========================================
// 5. LOGIN
// ==========================================
client.login(process.env.DISCORD_TOKEN);
