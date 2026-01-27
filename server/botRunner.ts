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

      // Registration Flow: Phone
      if (msg.contact && data.registrationState.get(chatId) === 'phone') {
        const customer = data.customerData.get(chatId.toString()) || {};
        customer.phone = msg.contact.phone_number;
        data.customerData.set(chatId.toString(), customer);
        data.registrationState.set(chatId, 'name');
        await bot.sendMessage(chatId, "Rahmat! Endi ismingizni kiriting:", {
          reply_markup: { remove_keyboard: true }
        });
        return;
      }

      if (!text) return;

      // Handle Start / Registration
      if (text === '/start' && !isAdmin) {
        const existing = data.customerData.get(chatId.toString());
        if (existing?.phone && existing?.name && existing?.province) {
          await bot.sendMessage(chatId, `Xush kelibsiz, ${existing.name}! Sizga qanday yordam bera olaman?`);
          return;
        }

        data.registrationState.set(chatId, 'phone');
        await bot.sendMessage(chatId, "Xush kelibsiz! Botdan foydalanish uchun ro'yxatdan o'ting.\nTelefon raqamingizni yuboring:", {
          reply_markup: {
            keyboard: [[{ text: "Telefon raqamni yuborish", request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: true
          }
        });
        return;
      }

      // Registration Flow: Name
      if (data.registrationState.get(chatId) === 'name' && !isAdmin) {
        const customer = data.customerData.get(chatId.toString()) || {};
        customer.name = text;
        data.customerData.set(chatId.toString(), customer);
        data.registrationState.set(chatId, 'province');

        const inline_keyboard = [];
        for (let i = 0; i < UZBEKISTAN_PROVINCES.length; i += 2) {
          const row = [
            { text: UZBEKISTAN_PROVINCES[i], callback_data: `prov_${UZBEKISTAN_PROVINCES[i]}` }
          ];
          if (UZBEKISTAN_PROVINCES[i+1]) {
            row.push({ text: UZBEKISTAN_PROVINCES[i+1], callback_data: `prov_${UZBEKISTAN_PROVINCES[i+1]}` });
          }
          inline_keyboard.push(row);
        }

        await bot.sendMessage(chatId, "Qaysi viloyatdansiz?", {
          reply_markup: { inline_keyboard }
        });
        return;
      }

      // Admin Commands
      if (text === '/admin') {
        if (isAdmin) {
          adminModes.set(chatId, true);
          const opts = {
            reply_markup: {
              keyboard: [
                [{ text: "Ma'lumot kiritish" }, { text: "Mijozlar tahlili" }],
                [{ text: "Foydalanuvchi rejimi" }]
              ],
              resize_keyboard: true
            }
          };
          await bot.sendMessage(chatId, "Admin panelga xush kelibsiz.", opts);
        } else {
          await bot.sendMessage(chatId, "Kechirasiz, sizda adminlik huquqi yo'q.");
        }
        return;
      }

      if (text === "Foydalanuvchi rejimi" && isAdmin) {
        adminModes.set(chatId, false);
        awaitingBusinessInfo.delete(chatId);
        await bot.sendMessage(chatId, "Foydalanuvchi rejimiga qaytdingiz.", {
          reply_markup: { remove_keyboard: true }
        });
        return;
      }

      // Admin Customer Analytics
      if (text === "Mijozlar tahlili" && isAdmin) {
        const allData = Array.from(data.customerData.values());
        if (allData.length === 0) {
          await bot.sendMessage(chatId, "Hozircha mijozlar haqida ma'lumot yo'q.");
          return;
        }

        try {
          const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ 
              role: "user", 
              content: `Mijozlar ro'yxati asosida qisqa (3-4 ta punkt) tahlil bering. Faqat eng muhim muammolar va so'rovlarni yozing.\nRo'yxat: ${JSON.stringify(allData)}` 
            }],
          });
          await bot.sendMessage(chatId, response.choices[0]?.message?.content || "Tahlil qilishda xatolik.");
        } catch (e) {
          await bot.sendMessage(chatId, "AI tahlilida xatolik yuz berdi.");
        }
        return;
      }

      if (text === "Ma'lumot kiritish" && isAdmin) {
        const opts = {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Yangi ma'lumot qo'shish", callback_data: 'update_info_append' }],
              [{ text: "Borini almashtirish", callback_data: 'update_info_replace' }],
            ]
          }
        };
        const content = data.businessInfo || "Ma'lumot kiritilmagan.";
        await bot.sendMessage(chatId, `Hozirgi ma'lumot:\n\n${content}\n\nQanday usulda ma'lumotni o'zgartirmoqchisiz?`, opts);
        return;
      }

      // Save Business Info
      const currentAwaitingMode = awaitingBusinessInfo.get(chatId);
      if (isAdmin && currentAwaitingMode) {
        if (currentAwaitingMode === 'append') {
          data.businessInfo = data.businessInfo ? `${data.businessInfo}\n${text}` : text;
          await bot.sendMessage(chatId, "Ma'lumot qo'shildi.");
        } else {
          data.businessInfo = text;
          await bot.sendMessage(chatId, "Ma'lumot yangilandi.");
        }
        awaitingBusinessInfo.delete(chatId);
        return;
      }

      // User Mode (AI Sales)
      if (!isAdmin || !adminModes.get(chatId)) {
        const customerData = data.customerData.get(chatId.toString());
        
        if (!customerData?.phone || !customerData?.name || !customerData?.province) {
          await bot.sendMessage(chatId, "Iltimos, avval ro'yxatdan o'ting. /start buyrug'ini bosing.");
          return;
        }

        if (!data.businessInfo) {
          await bot.sendMessage(chatId, "Hozircha men hech kimga xizmat qilmayapman. Iltimos, keyinroq urinib ko'ring.");
          return;
        }

        // Get or create chat logs for this user
        let logs = data.chatLogs.get(chatId.toString()) || [];
        logs.push({ role: 'user', content: text });
        
        try {
          const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: `Siz professional sotuvchisiz. Faqat ushbu biznes doirasida qisqa va aniq gapiring: "${data.businessInfo}".
                Mijoz ma'lumotlari: Ismi: ${customerData?.name}, Viloyat: ${customerData?.province}.
                Vazifangiz: Mijozga yordam berish va uni nima qiynayotganini aniqlash.
                Mijozga doimo ismini qo'shib, xushmuomalalik bilan murojaat qiling.
                Har doim qisqa javob bering (maksimal 2-3 jumla).`
              },
              ...logs.slice(-20).map(log => ({
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
          await bot.sendMessage(chatId, "Xatolik yuz berdi.");
        }
      }
    });

    bot.on('callback_query', async (query) => {
      const chatId = query.message!.chat.id;
      const callbackData = query.data || "";

      if (callbackData === 'update_info_append') {
        await bot.answerCallbackQuery(query.id);
        awaitingBusinessInfo.set(chatId, 'append');
        await bot.sendMessage(chatId, "Iltimos, qo'shiladigan yangi ma'lumotni yuboring:");
        return;
      }

      if (callbackData === 'update_info_replace') {
        await bot.answerCallbackQuery(query.id);
        awaitingBusinessInfo.set(chatId, 'replace');
        await bot.sendMessage(chatId, "Iltimos, butunlay yangi ma'lumotni yuboring:");
        return;
      }

      if (callbackData.startsWith('prov_')) {
        const province = callbackData.replace('prov_', '');
        const customer = data.customerData.get(chatId.toString()) || {};
        customer.province = province;
        data.customerData.set(chatId.toString(), customer);
        data.registrationState.delete(chatId);
        
        await bot.answerCallbackQuery(query.id);
        await bot.sendMessage(chatId, `Rahmat, ${customer.name}! Siz ${province}dansiz. Endi menga savollaringizni berishingiz mumkin.`);
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
