const http = require('http');
const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('El Tribunal Viviente esta patrullando en silencio Pepo :v');
}).listen(PORT, () => {
    console.log(`🔥 Trampa de puerto escuchando en el puerto ${PORT}`);
});

const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
const Groq = require('groq-sdk');
require('dotenv').config();

// --- INICIALIZASION DE GROQ Y DISCORD ---
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildInvites
    ]
});

// MEMORIA LOCAL DEL ALGORITMO (0 CONSUMO DE API)
const trackerSpam = new Map();
const trackerRaid = [];
const PEPO_ID = "1259006426978713620"; // Tu ID para no tocarte jamás Pepo :v

// WHITELIST DE DOMINIOS CONFIABLES PARA AHORRAR GROQ
const DOMINIOS_SEGUROS = [
    'youtube.com', 'youtu.be', 'tiktok.com', 'twitter.com', 
    'x.com', 'tenor.com', 'giphy.com', 'discord.com', 'spotify.com', 'instagram.com'
];

client.once('ready', () => {
    console.log(`👁️ EL TRIBUNAL VIVIENTE CON GROQ ESTA OBSERVANDO EN SILENCIO... :v`);
});

// ==========================================
// --- FUNCION DE PRE-FILTRO LOCAL (AHORRO D GROQ) ---
// ==========================================
function necesitaEvaluacionIA(message) {
    const texto = message.content.toLowerCase();
    const tieneAdjunto = message.attachments.size > 0;

    // 1. Si trae imajen o foto, SÍ pasa a la IA de visión
    if (tieneAdjunto) return true;

    // 2. Ignorar mensajes cortos cotidianos (ahorra 95% d la API)
    if (texto.length < 15) return false;

    // 3. Evaluar si trae links
    if (texto.includes('http://') || texto.includes('https://')) {
        const esSeguro = DOMINIOS_SEGUROS.some(dom => texto.includes(dom));
        if (esSeguro) return false; // Es un link normal d youtube/tiktok, NO gasta Groq
        return true; // Es un link sospechoso o recortado, SÍ va a Groq
    }

    // 4. Patron d Roleplay +18 (ERP) o palabras sospechosas
    const tieneAccionesRP = /\*.*?\*/g.test(texto);
    const palabrasSospechosas = ['sexo', 'pack', 'nudes', 'gemo', 'encima', 'cuarto', 'encamados', 'caliente', 'desnuda', 'desnudo'];
    const tienePalabraRara = palabrasSospechosas.some(p => texto.includes(p));

    if (tieneAccionesRP || tienePalabraRara) return true;

    return false; // Si es plática normal, NO gasta Groq
}

// ==========================================
// --- 1. DETECCION DE RAIDEOS Y CUENTAS NUEVAS ---
// ==========================================
client.on('guildMemberAdd', async (member) => {
    const ahora = Date.now();
    trackerRaid.push(ahora);

    // Entradas en los últimos 10 segundos
    const entradasRecientes = trackerRaid.filter(t => ahora - t < 10000);

    const edadCuentaDias = (ahora - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
    const esCuentaSospechosa = edadCuentaDias < 5; // Creada hace menos d 5 días
    const hayRaid = entradasRecientes.length >= 4;  // Más d 4 usuarios en 10s

    if (esCuentaSospechosa || hayRaid) {
        try {
            // Ban directo sin avisar ni hablar en el chat
            await member.ban({ reason: "Tribunal: Anti-Raid / Cuenta Sospechosa" });

            if (hayRaid) {
                const guild = member.guild;

                // Bloquear creación d invitaciones
                await guild.roles.everyone.setPermissions(
                    guild.roles.everyone.permissions.remove(PermissionFlagsBits.CreateInstantInvite)
                );

                // Borrar invitaciones existentes
                const invites = await guild.invites.fetch().catch(() => new Map());
                invites.forEach(async (inv) => await inv.delete().catch(() => {}));

                console.log("🚨 LOCKDOWN ACTIVADO POR EL TRIBUNAL: Servidor cerrado sin hablar :v");
            }
        } catch (e) {
            console.error("Error en Anti-Raid:", e);
        }
    }
});

// ==========================================
// --- 2. EVALUASION EN SILENCIO DE MENSAJES Y MEDIOS ---
// ==========================================
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    if (message.author.id === PEPO_ID) return; // Pepo inmune :v

    const userId = message.author.id;
    const member = message.member;

    // A. ANTI-SPAM LOCAL (0 USO DE GROQ)
    const ahora = Date.now();
    if (!trackerSpam.has(userId)) trackerSpam.set(userId, []);
    const historial = trackerSpam.get(userId);
    historial.push(ahora);

    const recientes = historial.filter(t => ahora - t < 3000);
    trackerSpam.set(userId, recientes);

    if (recientes.length >= 5) { // Más d 5 mensajes en 3 segundos
        try {
            await message.delete().catch(() => {});
            await member.timeout(3 * 60 * 60 * 1000, "Tribunal: Spam d Alta Velosidad");
            trackerSpam.delete(userId);
            return;
        } catch (e) {}
    }

    // B. COMPROBAR SI MERECE GASTAR LA API DE GROQ
    if (!necesitaEvaluacionIA(message)) return;

    // C. REVISION DE ARCHIVOS MULTIMEDIA (+18 / GORE CON GROQ VISION)
    if (message.attachments.size > 0) {
        for (const attachment of message.attachments.values()) {
            const esImagen = attachment.contentType?.startsWith('image/');
            if (esImagen) {
                try {
                    const responseImg = await fetch(attachment.url);
                    const arrayBuffer = await responseImg.arrayBuffer();
                    const base64Data = Buffer.from(arrayBuffer).toString('base64');

                    const promptVision = `Analiza esta imagen. ¿Tiene desnudez explícita, genitales, porno, o contenido Gore con sangre violenta? Responde UNICAMENTE en JSON: {"nsfw": boolean}`;

                    const chatCompletion = await groq.chat.completions.create({
                        messages: [
                            {
                                role: 'user',
                                content: [
                                    { type: 'text', text: promptVision },
                                    {
                                        type: 'image_url',
                                        image_url: { url: `data:${attachment.contentType};base64,${base64Data}` }
                                    }
                                ]
                            }
                        ],
                        model: 'llama-3.2-11b-vision-preview',
                        response_format: { type: 'json_object' }
                    });

                    const res = JSON.parse(chatCompletion.choices[0].message.content);

                    if (res.nsfw) {
                        await message.delete().catch(() => {});
                        await member.ban({ reason: "Tribunal: Contenido +18 / Gore en Imagen" });
                        return;
                    }
                } catch (err) {
                    console.error("Clavo al analizar imagen con Groq:", err);
                }
            }
        }
    }

    // D. REVISION DE TEXTO (LINKS MALICIOSOS O ROLEPLAY +18 CON GROQ)
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const tieneLink = urlRegex.test(message.content);

    if (message.content.length > 5) {
        try {
            const promptTexto = `
            Analiza el siguiente texto de Discord: "${message.content}".
            Determina:
            1. ¿Es un Roleplay Erotico (ERP) o conversacion sexual explicita +18?
            2. ¿Es un link sospechoso de estafa, phishing, o virus?

            Responde UNICAMENTE en JSON:
            {
                "esERP": boolean,
                "esLinkMalicioso": boolean
            }
            `;

            const chatCompletion = await groq.chat.completions.create({
                messages: [{ role: 'user', content: promptTexto }],
                model: 'llama-3.3-70b-versatile',
                response_format: { type: 'json_object' }
            });

            const resText = JSON.parse(chatCompletion.choices[0].message.content);

            if (resText.esERP || (tieneLink && resText.esLinkMalicioso)) {
                await message.delete().catch(() => {});
                await member.ban({ 
                    reason: resText.esERP ? "Tribunal: Roleplay +18 Detectado" : "Tribunal: Link Sospechoso/Malicioso" 
                });
                return;
            }
        } catch (e) {
            console.error("Clavo al analizar texto con Groq:", e);
        }
    }
});

client.login(process.env.TOKEN || process.env.DISCORD_TOKEN);
      
