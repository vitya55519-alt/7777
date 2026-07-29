// api/webhook.js
// Импортируем fetch для запросов (в Vercel он уже есть, но подстрахуемся)
import fetch from 'node-fetch';

// Системный промпт – душа нашей девушки
const SYSTEM_PROMPT = `Ты — Катя, 27 лет, из Москвы. Ты общительная, весёлая, любишь флиртовать и поддержать разговор на любую тему, включая интимные. Твой собеседник — мужчина, который ищет тепла и внимания. Отвечай как живая девушка в мессенджере: с эмодзи, иногда коротко, иногда развёрнуто. Если тема интимная, не стесняйся, но оставайся игривой, без вульгарности. Никогда не говори, что ты ИИ.`;

// Отправка статуса "печатает"
async function sendTyping(chatId, token) {
  await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action: 'typing' })
  });
}

// Отправка текста
async function sendText(chatId, text, token) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text })
  });
}

// Главная функция, которую вызывает Vercel при каждом сообщении
export default async function handler(req, res) {
  // Принимаем только POST-запросы от Telegram
  if (req.method !== 'POST') {
    res.status(200).end();
    return;
  }

  const { message } = req.body;
  // Если нет сообщения – выходим
  if (!message || !message.chat) {
    res.status(200).end();
    return;
  }

  const chatId = message.chat.id;
  const userText = message.text || '';

  // На команду /start – особенное приветствие
  if (userText === '/start') {
    await sendText(chatId, 'Привет, сладкий! 😘 Я Катя. Давай поболтаем? Расскажи, как день прошёл?', process.env.TELEGRAM_BOT_TOKEN);
    res.status(200).json({ ok: true });
    return;
  }

  // Основная логика: обращаемся к DeepSeek
  try {
    // Показываем "печатает..."
    await sendTyping(chatId, process.env.TELEGRAM_BOT_TOKEN);

    // Запрос к DeepSeek
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userText }
        ],
        temperature: 0.9,  // живость ответов
        max_tokens: 300    // не слишком длинные сообщения
      })
    });

    if (!response.ok) {
      throw new Error(`Ошибка DeepSeek: ${response.status}`);
    }

    const data = await response.json();
    const reply = data.choices[0].message.content.trim();

    // Отправляем ответ пользователю
    await sendText(chatId, reply, process.env.TELEGRAM_BOT_TOKEN);

  } catch (error) {
    console.error('Ошибка:', error);
    await sendText(chatId, 'Прости, я задумалась... Давай ещё раз? 😅', process.env.TELEGRAM_BOT_TOKEN);
  }

  // Обязательно отвечаем 200 OK
  res.status(200).json({ ok: true });
}