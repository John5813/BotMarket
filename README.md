# AIKadr — AI trend videolar sayti

Mijoz trenddagi shablonni tanlaydi, o'z rasmini (yoki uy hayvoni rasmini) yuklaydi va 1–3 daqiqada tayyor AI video/rasm oladi. To'lov — kreditlar orqali (Payme, Click).


---

## Imkoniyatlar

**Mijoz paneli**
- Bosh sahifa: trend banner (karusel), kategoriyalar bo'yicha avtomatik ijro etiluvchi video kartochkalar
- Shablon sahifasi: rasm yuklash (drag & drop), brauzerda sifat tekshiruvi, rozilik belgisi
- Generatsiya jarayoni (progress), natijani ko'rish, yuklab olish, ulashish
- "Ishlarim" galereyasi, profil, kredit balansi va muddatlari, kredit va to'lovlar tarixi
- Tariflar, Payme / Click orqali to'lov
- Telefon raqam + parol bilan ro'yxatdan o'tish, ro'yxatdan o'tganda bonus kredit

**Admin paneli** (`/admin`)
- Dashboard: daromad, AI xarajati, foyda, generatsiyalar, yangi foydalanuvchilar (grafiklar)
- **Shablonlar**: kod yozmasdan yangi shablon qo'shish — namuna video, asl video, AI retsepti (qadamlar), narx, "Sinab ko'rish" tugmasi (kreditsiz)
- Kategoriyalar, tariflar (kredit paketlari, muddati), foydalanuvchilar (kredit qo'shish/ayirish, bloklash, admin tayinlash)
- Generatsiyalar (texnik xato sabablari bilan), to'lovlar, sozlamalar

**Ichki tizim**
- Kredit "lot"lari: har bir to'ldirish o'z muddati bilan; avval muddati yaqin tugaydigani yechiladi; to'liq tarix
- AI muvaffaqiyatsiz bo'lsa — 1 marta qayta urinish, keyin kredit **avtomatik qaytariladi**
- Fon jarayoni (worker): holat bazada saqlanadi — server qayta ishga tushsa ham ish davom etadi
- Mijoz rasmlari 24 soatdan keyin avtomatik o'chiriladi (sozlanadi)
- Xavfsizlik: scrypt parol, sessiya (PostgreSQL), rate-limit, helmet/CSP, fayl imzosini tekshirish, natijalar faqat egasiga ko'rinadi, shablon promptlari mijozdan yashirin

---

## Texnologiyalar

React 18 + Vite + Tailwind · Express 5 + TypeScript · PostgreSQL + Drizzle ORM · fal.ai (AI modellar) · Payme Merchant API · Click SHOP API

---

## 1. Lokal ishga tushirish

Kerak: Node.js 20+ (22 tavsiya), PostgreSQL 14+.

```bash
npm install
cp .env.example .env          # DATABASE_URL va boshqalarni to'ldiring
npm run db:push               # jadvallarni yaratadi
npm run seed                  # demo kategoriyalar, 10 ta demo shablon, 4 ta tarif
npm run make-admin -- +998901234567 "KuchliParol123" "Ism"
npm run dev                   # http://localhost:5000
```

`FAL_KEY` bo'lmasa sayt **sinov rejimida** ishlaydi: AI chaqirilmaydi, ~6 soniyada shablon namunasi "natija" sifatida qaytadi. Shu bilan butun oqimni (to'lov, kredit, admin) pulsiz sinash mumkin.
`PAYMENTS_TEST_MODE=true` bo'lsa "Sinov to'lovi" tugmasi chiqadi.

> Demo shablonlardagi videolar — faqat namuna (emoji animatsiyalar). Haqiqiy shablon videolarini admin paneldan yuklang.

---

## 2. Kalitlar (`.env`)

| O'zgaruvchi | Qayerdan olinadi |
|---|---|
| `FAL_KEY` | [fal.ai/dashboard/keys](https://fal.ai/dashboard/keys) → "Add key". Hisobni oldindan to'ldiring (Billing) |
| `OPENROUTER_API_KEY` | [openrouter.ai/keys](https://openrouter.ai/keys) — admin "AI tahlil" uchun (bitta tahlil ~1–5 cent). `OPENROUTER_MODEL` bilan model tanlanadi |
| `PAYME_MERCHANT_ID`, `PAYME_KEY` | [business.payme.uz](https://business.payme.uz) → kassa → Developers. Avval **test kalit** bilan, keyin production |
| `PAYME_IKPU_CODE`, `PAYME_PACKAGE_CODE` | Fiskal chek uchun MXIK kodi: [tasnif.soliq.uz](https://tasnif.soliq.uz) |
| `CLICK_SERVICE_ID`, `CLICK_MERCHANT_ID`, `CLICK_SECRET_KEY` | [merchant.click.uz](https://merchant.click.uz) → servis sozlamalari |
| `SESSION_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

⚠️ Kalitlarni hech kimga (chatga ham) yubormang — faqat serverdagi `.env` faylida saqlang. `.env` git'ga tushmaydi.

---

## 3. To'lov tizimlarini ulash

### Payme
1. Payme Business kabinetida kassa yarating, **Endpoint URL**:
   `https://SIZNING-DOMEN.uz/api/payments/payme`
2. Hisob (account) maydoni nomi: **`order_id`**
3. `.env`: `PAYME_MERCHANT_ID`, `PAYME_KEY` (test kalit), `PAYME_TEST_MODE=true`
4. [test.paycom.uz](https://test.paycom.uz) sandbox'ida barcha testlarni o'tkazing (CheckPerform, Create, Perform, Cancel, timeout va h.k.)
5. Testlar o'tgach — production kalit va `PAYME_TEST_MODE=false`

Qo'llab-quvvatlanadigan metodlar: `CheckPerformTransaction`, `CreateTransaction`, `PerformTransaction`, `CancelTransaction` (kredit ishlatilmagan bo'lsa to'lovni qaytarish ham), `CheckTransaction`, `GetStatement`. Tranzaksiya 12 soat ichida bajarilmasa avtomatik bekor qilinadi.

### Click
1. Click merchant kabinetida servis sozlamalari:
   - Prepare URL: `https://SIZNING-DOMEN.uz/api/payments/click/prepare`
   - Complete URL: `https://SIZNING-DOMEN.uz/api/payments/click/complete`
2. `.env`: `CLICK_SERVICE_ID`, `CLICK_MERCHANT_ID`, `CLICK_SECRET_KEY`
3. Imzo (md5 sign_string) tekshiriladi, takroriy to'lov va summa xatolari qaytariladi.

Production'da **`PAYMENTS_TEST_MODE=false`** bo'lishi shart!

---

## 4. Serverga joylash (Ubuntu VPS)

```bash
# Node 22, PostgreSQL, Nginx
sudo apt install -y postgresql nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs

sudo -u postgres psql -c "CREATE USER aikadr WITH PASSWORD 'KUCHLI_PAROL';"
sudo -u postgres psql -c "CREATE DATABASE aikadr OWNER aikadr;"

cd /opt && git clone <repo> aikadr && cd aikadr
npm ci && cp .env.example .env && nano .env     # NODE_ENV production uchun to'ldiring
npm run db:push && npm run seed && npm run build
npm run make-admin -- +998XXXXXXXXX "Parol" "Ism"
```

**systemd** (`/etc/systemd/system/aikadr.service`):
```ini
[Unit]
Description=AIKadr
After=network.target postgresql.service

[Service]
WorkingDirectory=/opt/aikadr
ExecStart=/usr/bin/node dist/server.js
Environment=NODE_ENV=production
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```
`sudo systemctl enable --now aikadr`

**Nginx** (HTTPS uchun keyin `sudo certbot --nginx -d domen.uz`):
```nginx
server {
  server_name domen.uz;
  client_max_body_size 60m;
  location / {
    proxy_pass http://127.0.0.1:5000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```
Sessiya cookie'si production'da faqat HTTPS orqali ishlaydi — SSL sertifikat shart.

`storage/` papkasi (namuna videolar, natijalar) zaxira nusxasini muntazam oling.

---

## 4.1. Replit'da ishga tushirish

1. Replit'da PostgreSQL bazasini yoqing (`DATABASE_URL` avtomatik qo'shiladi)
2. **Secrets** bo'limiga `.env.example`dagi kalitlarni qo'shing (`SESSION_SECRET`, `FAL_KEY`, Payme, Click, `PUBLIC_URL`)
3. Shell'da: `npm install && npm run db:push && npm run seed && npm run make-admin -- +998XXXXXXXXX "Parol" "Ism"`
4. **Run** — sinov uchun; **Deploy → Reserved VM** — doimiy ishlash uchun (fon worker uzluksiz ishlashi kerak, shuning uchun Autoscale mos emas)

⚠️ Replit deploy'da serverga yozilgan fayllar (yuklangan shablon videolari, natijalar) qayta deploy qilinganda o'chib ketishi mumkin. Jiddiy ishga tushirish uchun VPS (yuqoridagi 4-bo'lim) tavsiya etiladi.

## 5. Yangi shablon qo'shish

1. Admin → **Shablonlar → Yangi shablon** — avval video yoki rasm so'raladi
2. **🤖 AI tahlil qilsin**: AI kadrlarni ko'rib personajlarni ramka bilan ko'rsatadi, qaysi personaj almashtirilishini tanlaysiz, nom/tavsif/promptlar avtomatik yoziladi. Yoki **Qo'lda kiritaman**
3. fal.ai Playground'da natijani solishtirib, promptlarni kerak bo'lsa tahrirlang
4. Turini o'zgartirish mumkin — qadamlar avtomatik to'ldiriladi:
   - **Qahramon almashtirish** (raqs, hayvon): `fal-ai/wan/v2.2-14b/animate/replace` — asl videoni yuklang
   - **Effekt**: `fal-ai/nano-banana/edit` → `fal-ai/kling-video/v2.5-turbo/pro/image-to-video` — promptlarni yozing
   - **Fotosessiya**: bir nechta `nano-banana/edit` qadam, har biri "natija mijozga beriladi"
   - **Maxsus**: istalgan fal.ai modeli (endpoint nomi + JSON parametrlar)
5. Saqlash → **Sinab ko'rish** (o'z rasmingiz bilan, kreditsiz)
6. Natija yaxshi bo'lsa — "Faol" ni yoqing

### Ko'p personajli video (2–4 kishi)
- AI tahlilda videoda 2+ odam topilsa **"Ko'p personajli"** turi tavsiya qilinadi — almashtiriladigan personajlarni tartib bilan belgilaysiz (1-tanlangan → mijozning 1-rasmi)
- Mijoz sahifasida har bir personaj uchun alohida rasm joyi chiqadi ("Kuyov", "Kelin" ...) — nomlarni "Mijozdan so'raladigan rasmlar" bo'limida o'zgartirasiz
- Model: **Kling O1 Video Edit** (`fal-ai/kling-video/o1/video-to-video/edit`) — promptda `@Image1`, `@Image2`; asl video **MP4/MOV, 3–10 soniya, 720p+**, ko'pi bilan 4 ta rasm
- Tannarx yuqoriroq (~$1/video) — narxni 4+ kredit qiling. Endpoint nomi va parametrlarini fal.ai sahifasida tekshirib oling

O'rinbosarlar: `{{user_image}}` (= `{{user_image_1}}`), `{{user_image_2}}`..., `{{template_video}}`, `{{template_image}}`, `{{prev}}`, `{{step_0}}`, `{{step_1}}`...

---

## 6. Muhim huquqiy eslatmalar

- **Biometrik ma'lumotlar.** "Shaxsga doir ma'lumotlar to'g'risida"gi qonunga ko'ra biometrik ma'lumotlar O'zbekistondagi serverlarda saqlanishi kerak. Serverni O'zbekiston hosting'ida joylashtiring va yuz rasmini xorijiy AI API'ga yuborish bo'yicha **yurist bilan maslahatlashing**. Tizim rasmlarni 24 soatda o'chiradi va foydalanuvchidan rozilik oladi.
- **Mualliflik huquqi.** Mashhur klip va qo'shiqlardan shablon qilmang — o'z videolaringiz va litsenziyali musiqadan foydalaning.
- **Deepfake.** Foydalanish shartlari (`/terms`) boshqalarni ruxsatsiz ishlatishni taqiqlaydi; admin panelda foydalanuvchini bloklash mumkin.
- `inswapper_128` (InsightFace) modeli tijoratda bepul emas — fal.ai'dagi tijoriy litsenziyali modellardan foydalaning.

---

## 7. Cheklovlar va keyingi qadamlar

- Worker bitta server nusxasi uchun mo'ljallangan. Ko'p nusxada ishlatish uchun Redis navbati (BullMQ) qo'shish kerak.
- Fotosessiya qadamlari ketma-ket bajariladi (parallel qilish mumkin).
- SMS orqali telefonni tasdiqlash (Eskiz.uz) — bepul bonus suiiste'molini kamaytirish uchun tavsiya etiladi.
- NSFW filtr: fal.ai modellaridagi `enable_safety_checker` parametrini yoqing yoki alohida moderatsiya modeli qo'shing.
- Telegram Mini App sifatida ham chiqarish mumkin.

## Fayl tuzilishi

```
./
├── shared/          schema.ts (baza), presets.ts (AI retsept andozalari)
├── server/
│   ├── index.ts     Express server
│   ├── worker.ts    AI generatsiya fon jarayoni
│   ├── credits.ts   kredit tizimi
│   ├── ai/          fal.ai va sinov provayderlari, pipeline
│   ├── payments/    payme.ts, click.ts, orders.ts
│   ├── routes/      public, client, admin API
│   ├── seed.ts      demo ma'lumotlar
│   └── scripts/make-admin.ts
└── client/src/
    ├── pages/       mijoz sahifalari
    └── pages/admin/ admin panel
```
