// Прокси к Anthropic API. Ключ хранится ТОЛЬКО в переменной окружения Netlify (ANTHROPIC_API_KEY).
const MODEL = "claude-sonnet-4-6";

async function ask(system, user, max = 700) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: max, system, messages: [{ role: "user", content: user }] }),
  });
  if (!r.ok) throw new Error("API " + r.status);
  const d = await r.json();
  return d.content.map((b) => b.text || "").join("");
}

exports.handler = async (event) => {
  const json = (code, obj) => ({ statusCode: code, headers: { "content-type": "application/json" }, body: JSON.stringify(obj) });
  if (event.httpMethod !== "POST") return json(405, { error: "POST only" });
  if (!process.env.ANTHROPIC_API_KEY) return json(500, { error: "no key" });
  try {
    const b = JSON.parse(event.body || "{}");
    if (b.mode === "feedback") {
      const text = await ask(
        "Ты добрый репетитор по математике. Отвечай по-русски, коротко (до 120 слов), без markdown. Структура: 1) что именно не так в рассуждении ученика, 2) как решать правильно по шагам, 3) один совет, как не ошибаться в таких задачах.",
        `Тема: ${String(b.topic).slice(0, 80)}\nВопрос: ${String(b.question).slice(0, 400)}\nВарианты: ${(b.options || []).map(String).join(" | ").slice(0, 400)}\nУченик выбрал: ${String(b.chosen).slice(0, 100)}\nПравильный ответ: ${String(b.correct).slice(0, 100)}`
      );
      return json(200, { text });
    }
    if (b.mode === "generate") {
      const text = await ask(
        "Ты составитель школьных/университетских тестов по математике. Верни ТОЛЬКО JSON-массив из 10 объектов без markdown и пояснений. Формат объекта: {\"q\":\"вопрос\",\"o\":[\"A\",\"B\",\"C\",\"D\"],\"a\":индекс_правильного_0-3,\"e\":\"краткое решение\",\"t\":\"тема\",\"l\":\"easy|medium|hard\"}. Первые 3 вопроса easy, следующие 4 medium, последние 3 hard. Темы разные (алгебра, геометрия, вероятность, тригонометрия, производные, логарифмы, прогрессии, комбинаторика и т.д.). Только обычный Unicode-текст, ответы проверь дважды, правильный вариант должен быть ровно один.",
        "Составь новый квиз. Seed: " + Math.random(),
        4000
      );
      const arr = JSON.parse(text.replace(/```json|```/g, "").trim());
      return json(200, { questions: arr });
    }
    return json(400, { error: "bad mode" });
  } catch (e) {
    return json(502, { error: String(e.message || e) });
  }
};
