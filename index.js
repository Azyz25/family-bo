const crypto = require('crypto');
const fs = require('fs');
const QR = require('qrcode');
const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');

const config = require('./config.json');
const admins = require('./admins.json');
let customCommands = require('./customCommands.json');

// تأكد أن مجلد public موجود
if (!fs.existsSync('./public')) {
    fs.mkdirSync('./public');
}

// إعداد السيرفر لعرض صورة QR
const app = express();
app.use(express.static('public'));
app.get('/', (req, res) => {
    res.send('<h1>كود QR للبوت</h1><img src="/qr.png" style="width:300px;border:4px solid #000;border-radius:16px;" />');
});
app.listen(process.env.PORT || 3000, () => {
    console.log("🌐 السيرفر شغّال على /");
});

function saveCustomCommands() {
    fs.writeFileSync('./customCommands.json', JSON.stringify(customCommands, null, 4), 'utf-8');
}

async function startBot() {
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

    const sock = makeWASocket({ version, auth: state });

    sock.ev.on('connection.update', async (update) => {
        const { qr, connection } = update;
        if (qr) {
            console.log("🔒 يتم إنشاء كود QR...");
            await QR.toFile('./public/qr.png', qr);
        }

        if (connection === 'open') {
            console.log("✅ تم الاتصال بنجاح مع واتساب!");
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message) return;

        const sender = msg.key.remoteJid.replace('@s.whatsapp.net', '');
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (!text) return;

        if (config.defaultReplies[text]) {
            await sock.sendMessage(msg.key.remoteJid, { text: config.defaultReplies[text] });
            return;
        }

        if (customCommands[text]) {
            await sock.sendMessage(msg.key.remoteJid, { text: customCommands[text] });
            return;
        }

        if (admins.admins.includes(sender)) {
            if (text === '!تحكم') {
                await sock.sendMessage(msg.key.remoteJid, {
                    text: "أهلاً مسؤول! وش تبي تسوي؟\n1. إضافة أمر (!اضافة:الأمر=الرد)\n2. حذف أمر (!حذف:الأمر)\n3. تعديل أمر (!تعديل:الأمر=رد جديد)"
                });
                return;
            }

            if (text.startsWith('!اضافة:')) {
                const [, payload] = text.split('!اضافة:');
                const [command, reply] = payload.split('=');
                if (command && reply) {
                    customCommands[command.trim()] = reply.trim();
                    saveCustomCommands();
                    await sock.sendMessage(msg.key.remoteJid, { text: `✅ تمت إضافة الأمر ${command.trim()}` });
                }
                return;
            }

            if (text.startsWith('!حذف:')) {
                const command = text.split('!حذف:')[1].trim();
                if (customCommands[command]) {
                    delete customCommands[command];
                    saveCustomCommands();
                    await sock.sendMessage(msg.key.remoteJid, { text: `🗑️ تم حذف الأمر ${command}` });
                } else {
                    await sock.sendMessage(msg.key.remoteJid, { text: `❌ الأمر ${command} غير موجود.` });
                }
                return;
            }

            if (text.startsWith('!تعديل:')) {
                const [, payload] = text.split('!تعديل:');
                const [command, newReply] = payload.split('=');
                if (customCommands[command.trim()]) {
                    customCommands[command.trim()] = newReply.trim();
                    saveCustomCommands();
                    await sock.sendMessage(msg.key.remoteJid, { text: `✏️ تم تعديل الرد على ${command.trim()}` });
                } else {
                    await sock.sendMessage(msg.key.remoteJid, { text: `❌ الأمر ${command.trim()} غير موجود.` });
                }
                return;
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

startBot();
