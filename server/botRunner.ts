import TelegramBot from 'node-telegram-bot-api';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// Store running bot instances
const runningBots = new Map<number, TelegramBot>();

// In-memory storage for bot data (per instance)
const botData = new Map<number, {
  businessInfo: string;
  customerData: Map<string, any>;
  chatLogs: Map<string, Array<{ role: string; content: string }>>;
  registrationState: Map<number, string>;
}>();

const UZBEKISTAN_PROVINCES = [
  "Toshkent", "Andijon", "Buxoro", "Farg'ona", "Jizzax",
  "Xorazm", "Namangan", "Navoiy", "Qashqadaryo", "Samarqand",
  "Sirdaryo", "Surxondaryo", "Qoraqalpog'iston"
];

export function startEdufailBot(instanceId: number, token: string, adminTelegramId?: string): boolean {
  if (runningBots.has(instanceId)) {
    return false; // Already running
  }

  try {
    const bot = new TelegramBot(token, { polling: true });
    
    // Initialize data storage for this instance
    botData.set(instanceId, {
      businessInfo: "",
      customerData: new Map(),
      chatLogs: new Map(),
      registrationState: new Map(),
    });

    const data = botData.get(instanceId)!;
    const adminId = adminTelegramId;
    const adminModes = new Map<number, boolean>();
    const awaitingBusinessInfo = new Map<number, 'append' | 'replace' | null>();

    bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from?.id;
      const text = msg.text;
      const isAdmin = userId?.toString() === adminId;
      const userName = msg.from?.first_name || "Foydalanuvchi";

      if (!text) return;

      // Handle Start
      if (text === '/start') {
        if (isAdmin) {
          await bot.sendMessage(chatId, `Salom, Admin! /admin buyrug'i bilan admin panelga kiring yoki oddiy xabar yozing.`);
        } else {
          await bot.sendMessage(chatId, `Salom, ${userName}! Men AI yordamchiman. Sizga qanday yordam bera olaman?`);
        }
        return;
      }

      // Admin Commands
      if (text === '/admin') {
        if (isAdmin) {
          adminModes.set(chatId, true);
          const opts = {
            reply_markup: {
              keyboard: [
                [{ text: "Ma'lumot kiritish" }, { text: "Suhbatlar" }],
                [{ text: "Oddiy rejim" }]
              ],
              resize_keyboard: true
            }
          };
          await bot.sendMessage(chatId, "Admin panel. Biznes ma'lumotini kiriting yoki suhbatlarni ko'ring.", opts);
        } else {
          await bot.sendMessage(chatId, "Sizda adminlik huquqi yo'q.");
        }
        return;
      }

      if (text === "Oddiy rejim" && isAdmin) {
        adminModes.set(chatId, false);
        awaitingBusinessInfo.delete(chatId);
        await bot.sendMessage(chatId, "Oddiy rejimga qaytdingiz.", { reply_markup: { remove_keyboard: true } });
        return;
      }

      if (text === "Suhbatlar" && isAdmin) {
        const allLogs = Array.from(data.chatLogs.entries());
        if (allLogs.length === 0) {
          await bot.sendMessage(chatId, "Hozircha suhbatlar yo'q.");
        } else {
          let summary = `Jami ${allLogs.length} ta foydalanuvchi suhbatlashgan.`;
          await bot.sendMessage(chatId, summary);
        }
        return;
      }

      if (text === "Ma'lumot kiritish" && isAdmin) {
        awaitingBusinessInfo.set(chatId, 'replace');
        const content = data.businessInfo || "Hali kiritilmagan";
        await bot.sendMessage(chatId, `Hozirgi ma'lumot:\n${content}\n\nYangi ma'lumotni yozing:`);
        return;
      }

      // Save Business Info
      if (isAdmin && awaitingBusinessInfo.get(chatId)) {
        data.businessInfo = text;
        awaitingBusinessInfo.delete(chatId);
        await bot.sendMessage(chatId, "Ma'lumot saqlandi!");
        return;
      }

      // AI Chat for everyone
      let logs = data.chatLogs.get(chatId.toString()) || [];
      logs.push({ role: 'user', content: text });

      const businessContext = data.businessInfo || "Umumiy AI yordamchi. Foydalanuvchilarga yordam bering.";
      
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `Siz yordamchi botsiz. Kontekst: ${businessContext}
Foydalanuvchi ismi: ${userName}. Qisqa va aniq javob bering (2-3 jumla).`
            },
            ...logs.slice(-10).map(log => ({
              role: log.role as "user" | "assistant",
              content: log.content
            })),
          ],
        });

        const reply = response.choices[0]?.message?.content || "Xatolik yuz berdi.";
        logs.push({ role: 'assistant', content: reply });
        data.chatLogs.set(chatId.toString(), logs);
        
        await bot.sendMessage(chatId, reply);
      } catch (error) {
        console.error("AI Error:", error);
        await bot.sendMessage(chatId, "Xatolik yuz berdi. Keyinroq urinib ko'ring.");
      }
    });


    bot.on('polling_error', (err) => {
      console.error(`Bot ${instanceId} polling error:`, err.message);
    });

    runningBots.set(instanceId, bot);
    console.log(`Bot instance ${instanceId} started successfully`);
    return true;
  } catch (error) {
    console.error(`Failed to start bot ${instanceId}:`, error);
    return false;
  }
}

export function stopBot(instanceId: number): boolean {
  const bot = runningBots.get(instanceId);
  if (bot) {
    bot.stopPolling();
    runningBots.delete(instanceId);
    botData.delete(instanceId);
    console.log(`Bot instance ${instanceId} stopped`);
    return true;
  }
  return false;
}

export function isBotRunning(instanceId: number): boolean {
  return runningBots.has(instanceId);
}

export function getRunningBotIds(): number[] {
  return Array.from(runningBots.keys());
}
