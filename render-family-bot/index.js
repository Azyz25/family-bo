const crypto = require('crypto');
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const fs = require('fs');

const config = require('./config.json');
const admins = require('./admins.json');
const customCommands = require('./customCommands.json');

async function startBot() {
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true,
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message) return;

        const sender = msg.key.remoteJid.replace('@s.whatsapp.net', '');
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

        if (!text) return;

        if (config.defaultReplies[text]) {
            await sock.sendMessage(msg.key.remoteJid, { text: config.defaultReplies[text] });
        }

        if (customCommands[text]) {
            await sock.sendMessage(msg.key.remoteJid, { text: customCommands[text] });
        }

        if (text === '!تحكم' && admins.admins.includes(sender)) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: "أهلاً مسؤول! وش تبي تسوي؟\n1. إضافة أمر جديد (!اضافة)\n2. حذف أمر (!حذف)\n3. تعديل أمر (!تعديل)\n4. عرض الأقسام (!أقسام)"
            });
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

startBot();
