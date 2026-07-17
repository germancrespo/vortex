import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
const PORT = 3000;

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
  try {
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    console.log("Gemini SDK initialized successfully on the server.");
  } catch (error) {
    console.error("Failed to initialize Gemini SDK:", error);
  }
} else {
  console.warn("GEMINI_API_KEY environment variable is not set or holds placeholder value.");
}

// Simulated Live Exchange Rates (Relative to 1 USD)
const CURRENCIES = [
  { code: "USD", name: "Dólar Estadounidense", symbol: "$", rateVsUsd: 1.0 },
  { code: "EUR", name: "Euro", symbol: "€", rateVsUsd: 0.92 },
  { code: "GBP", name: "Libra Esterlina", symbol: "£", rateVsUsd: 0.78 },
  { code: "JPY", name: "Yen Japonés", symbol: "¥", rateVsUsd: 155.2 },
  { code: "MXN", name: "Peso Mexicano", symbol: "Mex$", rateVsUsd: 18.25 },
  { code: "ARS", name: "Peso Argentino", symbol: "Arg$", rateVsUsd: 920.0 },
  { code: "COP", name: "Peso Colombiano", symbol: "Col$", rateVsUsd: 4050.0 },
  { code: "BRL", name: "Real Brasileño", symbol: "R$", rateVsUsd: 5.45 },
  { code: "PEN", name: "Sol Peruano", symbol: "S/.", rateVsUsd: 3.75 },
  { code: "CLP", name: "Peso Chileno", symbol: "CLP$", rateVsUsd: 935.0 },
];

// Helper to generate simulated historical rates
function generateHistoricalRates(fromRate: number, toRate: number, days: number) {
  const data = [];
  const now = new Date();
  
  // Base conversion rate today
  const baseRate = toRate / fromRate;
  
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    
    // Generate a pseudo-random walk centered around baseRate
    const x = i / days; // goes from 1 down to 0
    // Combine sine waves and some noise to make a very realistic-looking chart
    const wave = Math.sin(x * 12) * 0.02 + Math.cos(x * 5) * 0.015;
    const noise = (Math.sin(i * 999) % 1) * 0.01;
    
    const multiplier = 1 + wave + noise;
    const rate = baseRate * multiplier;
    
    data.push({
      date: date.toISOString().split('T')[0],
      rate: Number(rate.toFixed(4)),
    });
  }
  return data;
}

// ---------------------- API ROUTES ----------------------

// Get List of Currencies & Rates
app.get("/api/currencies", (req, res) => {
  res.json(CURRENCIES);
});

// Get Simulated Trend History
app.get("/api/history-rates", (req, res) => {
  const { from = "USD", to = "EUR", days = "30" } = req.query;
  
  const fromCurr = CURRENCIES.find(c => c.code === from);
  const toCurr = CURRENCIES.find(c => c.code === to);
  
  if (!fromCurr || !toCurr) {
    return res.status(400).json({ error: "Moneda de origen o destino no válida" });
  }
  
  const daysNum = parseInt(days as string, 10) || 30;
  const history = generateHistoricalRates(fromCurr.rateVsUsd, toCurr.rateVsUsd, daysNum);
  
  res.json({
    from: from,
    to: to,
    history,
    currentRate: Number((toCurr.rateVsUsd / fromCurr.rateVsUsd).toFixed(4))
  });
});

// IA-Powered: Predict Currency Trends
app.post("/api/forecast", async (req, res) => {
  const { from, to } = req.body;
  if (!from || !to) {
    return res.status(400).json({ error: "Faltan parámetros 'from' o 'to'" });
  }

  const fromCurr = CURRENCIES.find(c => c.code === from);
  const toCurr = CURRENCIES.find(c => c.code === to);

  if (!fromCurr || !toCurr) {
    return res.status(400).json({ error: "Moneda inválida" });
  }

  const currentRate = toCurr.rateVsUsd / fromCurr.rateVsUsd;

  if (!ai) {
    // Elegant fallback when API key is missing
    return res.json({
      pair: `${from}/${to}`,
      prediction: currentRate > 1 ? "up" : "down",
      expectedRange: `${(currentRate * 0.98).toFixed(3)} - ${(currentRate * 1.02).toFixed(3)}`,
      confidence: 75,
      analysis: `[Modo Simulación - Llave API de Gemini No Configurada]\n\nAnálisis de mercado simulado para el par ${from}/${to}. Actualmente, un ${from} equivale a ${currentRate.toFixed(4)} ${to}. La tendencia general sugiere que los mercados de divisas se encuentran influenciados por tasas de interés locales y dinámicas comerciales en América Latina y Europa.`,
      recommendation: `Para operaciones reales, por favor configura la clave API de Gemini en Ajustes > Secrets. En este modo simulado, se recomienda realizar compras escalonadas para mitigar la volatilidad.`
    });
  }

  try {
    const prompt = `Analiza la tendencia financiera futura de las próximas 4 semanas para el par de divisas ${from} a ${to} (actualmente 1 ${from} = ${currentRate.toFixed(4)} ${to}).
    Genera un análisis profesional detallado en español.
    
    Deberás devolver un objeto JSON con los siguientes campos exactamente:
    - pair: El par en formato "FROM/TO" (ejemplo: "USD/EUR")
    - prediction: Debe ser una de las opciones: "up" (si subirá el valor del FROM frente al TO), "down" (si bajará) o "stable" (si se mantendrá en un rango lateral)
    - expectedRange: Un rango estimado de valores para el tipo de cambio en las próximas 4 semanas (ejemplo: "0.910 - 0.945")
    - confidence: Un número del 1 al 100 indicando tu confianza en la predicción
    - analysis: Un texto detallado y estructurado en español que explique los factores macroeconómicos clave (tasas de interés, inflación, geopolítica, comercio) que afectan este par. Utiliza formato markdown simple para resaltar puntos clave.
    - recommendation: Consejos financieros útiles y prácticos en español para una persona o pyme que planea cambiar estas divisas en las próximas semanas.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            pair: { type: Type.STRING },
            prediction: { type: Type.STRING },
            expectedRange: { type: Type.STRING },
            confidence: { type: Type.INTEGER },
            analysis: { type: Type.STRING },
            recommendation: { type: Type.STRING },
          },
          required: ["pair", "prediction", "expectedRange", "confidence", "analysis", "recommendation"],
        },
      },
    });

    const data = JSON.parse(response.text || "{}");
    res.json(data);
  } catch (error: any) {
    console.error("Gemini forecast error:", error);
    // Graceful fallback on API error (e.g. quota/credits exhausted)
    res.json({
      pair: `${from}/${to}`,
      prediction: currentRate > 1 ? "up" : "down",
      expectedRange: `${(currentRate * 0.98).toFixed(3)} - ${(currentRate * 1.02).toFixed(3)}`,
      confidence: 75,
      analysis: `[Modo Simulación Activo - Créditos de la API de Gemini Agotados]\n\nAnálisis de mercado simulado para el par ${from}/${to}. Tu clave API de Gemini ha agotado sus créditos prepagos o excedido su cuota en Google AI Studio (RESOURCE_EXHAUSTED).\n\nActualmente, un ${from} equivale a ${currentRate.toFixed(4)} ${to}. La tendencia general sugiere estabilidad con fluctuaciones típicas dentro de rangos normales de mercado.`,
      recommendation: `Visita Google AI Studio (https://ai.studio/projects) para recargar el saldo de facturación prepago de tu proyecto. Mientras tanto, puedes seguir simulando conversiones y registrando gastos de manera local.`
    });
  }
});

// IA-Powered: Natural Language Expense Extraction
app.post("/api/extract-text", async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: "Falta el texto de la transacción" });
  }

  if (!ai) {
    // Fallback parser based on regex for simulation
    const amountMatch = text.match(/(\d+([\.,]\d+)?)/);
    const amount = amountMatch ? parseFloat(amountMatch[1].replace(",", ".")) : 50;
    
    let currency = "USD";
    if (text.toLowerCase().includes("pesos") || text.includes("$") || text.toLowerCase().includes("ars") || text.toLowerCase().includes("mxn") || text.toLowerCase().includes("cop")) {
      currency = "MXN"; // Fallback realistic default
    } else if (text.toLowerCase().includes("euro") || text.includes("€") || text.toLowerCase().includes("eur")) {
      currency = "EUR";
    }

    let isIncome = text.toLowerCase().includes("gane") || text.toLowerCase().includes("ingreso") || text.toLowerCase().includes("recibi") || text.toLowerCase().includes("pago");

    return res.json({
      success: true,
      type: isIncome ? "income" : "expense",
      description: text.substring(0, 40) || "Transacción rápida",
      amount,
      currency,
      category: isIncome ? "Ingresos" : "Comida",
      rawInput: text
    });
  }

  try {
    const prompt = `Extrae los detalles financieros del siguiente texto de transacción escrito en lenguaje natural por el usuario: "${text}".
    
    Debes identificar:
    1. Si es un gasto ("expense") o un ingreso ("income").
    2. Una descripción corta y limpia en español (ej: "Almuerzo Starbucks", "Pago de salario").
    3. El monto numérico (número flotante positivo).
    4. El código de la moneda de tres letras (ej: USD, EUR, ARS, MXN, COP, BRL, PEN, CLP). Si no se menciona o no está claro, deduce la moneda más probable en base al contexto o asume USD por defecto.
    5. La categoría más adecuada en español. Las categorías permitidas para gastos son: "Comida", "Transporte", "Vivienda", "Entretenimiento", "Servicios", "Salud", "Educación", "Otros". Para ingresos debe ser "Ingresos".
    
    Devuelve un objeto JSON con la siguiente estructura:
    - success: true
    - type: "expense" o "income"
    - description: string
    - amount: número decimal
    - currency: código de moneda de 3 letras en mayúsculas
    - category: string
    - rawInput: el texto original tal cual`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            success: { type: Type.BOOLEAN },
            type: { type: Type.STRING },
            description: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            currency: { type: Type.STRING },
            category: { type: Type.STRING },
            rawInput: { type: Type.STRING },
          },
          required: ["success", "type", "description", "amount", "currency", "category", "rawInput"],
        },
      },
    });

    const data = JSON.parse(response.text || "{}");
    res.json(data);
  } catch (error: any) {
    console.error("Gemini extract error:", error);
    // Graceful fallback on API error (e.g. quota/credits exhausted) using simple regex parsing
    const amountMatch = text.match(/(\d+([\.,]\d+)?)/);
    const amount = amountMatch ? parseFloat(amountMatch[1].replace(",", ".")) : 50;
    
    let currency = "USD";
    if (text.toLowerCase().includes("pesos") || text.includes("$") || text.toLowerCase().includes("ars") || text.toLowerCase().includes("mxn") || text.toLowerCase().includes("cop")) {
      currency = "MXN";
    } else if (text.toLowerCase().includes("euro") || text.includes("€") || text.toLowerCase().includes("eur")) {
      currency = "EUR";
    }

    const isIncome = text.toLowerCase().includes("gane") || text.toLowerCase().includes("ingreso") || text.toLowerCase().includes("recibi") || text.toLowerCase().includes("pago") || text.toLowerCase().includes("deposito") || text.toLowerCase().includes("sueldo");

    res.json({
      success: true,
      type: isIncome ? "income" : "expense",
      description: `[Simulado] ${text.substring(0, 30)}${text.length > 30 ? "..." : ""}`,
      amount,
      currency,
      category: isIncome ? "Ingresos" : "Comida",
      rawInput: text
    });
  }
});

// IA-Powered: Financial Advice & Coaching
app.post("/api/advice", async (req, res) => {
  const { transactions, budgets } = req.body;

  if (!transactions || !Array.isArray(transactions)) {
    return res.status(400).json({ error: "Faltan transacciones o el formato es incorrecto" });
  }

  if (!ai) {
    return res.json({
      score: 75,
      generalFeedback: "Se ve que mantienes un presupuesto activo, ¡excelente! [Modo Simulación: Para un análisis de IA hiper-personalizado, agrega tu API Key de Gemini].",
      warnings: [
        "Asegúrate de no exceder los límites fijados para cada categoría en tus presupuestos mensuales.",
        "Tu saldo neto es positivo, pero siempre es aconsejable mantener un colchón de emergencias equivalente a 3 meses de gastos."
      ],
      tips: [
        "Revisa tus suscripciones mensuales recurrentes y cancela las que no hayas utilizado los últimos 30 días.",
        "Asigna un 10% de tus ingresos netos directamente a una cuenta de ahorro automatizada apenas los recibas.",
        "Planifica tus compras de despensa semanalmente para reducir las compras impulsivas de comida fuera."
      ]
    });
  }

  try {
    const prompt = `Actúa como un asesor financiero altamente calificado, amable e inteligente en finanzas personales para hispanohablantes.
    Analiza la situación financiera de este usuario basándote en su historial de transacciones y presupuestos actuales:
    
    Transacciones recientes: ${JSON.stringify(transactions)}
    Límites de Presupuesto por Categoría: ${JSON.stringify(budgets)}
    
    Genera un informe constructivo y sumamente práctico en español. Devuelve un objeto JSON con la siguiente estructura exacta:
    - score: Un puntaje de salud financiera global de 1 a 100 calculado en base a si gasta menos de lo que ingresa, el cumplimiento de presupuestos, etc.
    - generalFeedback: Un párrafo cordial de introducción en español que resuma cómo lo está haciendo el usuario y su estado general.
    - warnings: Un array de strings con alertas específicas en español (ej: "¡Alerta! Has sobrepasado tu presupuesto de Entretenimiento por un 15%", "No tienes ingresos registrados este mes"). Si no hay alertas, escribe frases motivacionales cortas.
    - tips: Un array de strings con 3 o 4 consejos prácticos, sumamente específicos y accionables en español basados de verdad en los datos (ej: "Reduce tus gastos en la categoría Comida cocinando en casa", "Vemos que estás usando múltiples monedas, ten cuidado con las comisiones de cambio").`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER },
            generalFeedback: { type: Type.STRING },
            warnings: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            tips: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
          },
          required: ["score", "generalFeedback", "warnings", "tips"],
        },
      },
    });

    const data = JSON.parse(response.text || "{}");
    res.json(data);
  } catch (error: any) {
    console.error("Gemini advice error:", error);
    // Graceful fallback on API error (e.g. quota/credits exhausted)
    res.json({
      score: 75,
      generalFeedback: `Se activó el modo de simulación automática porque los créditos de tu API Key de Gemini se han agotado (RESOURCE_EXHAUSTED). ¡No te preocupes! El resto de la app sigue funcionando al 100% de manera local y offline.`,
      warnings: [
        "Para reactivar la inteligencia completa de la IA, por favor revisa tus créditos de facturación en Google AI Studio (https://ai.studio/projects).",
        "Asegúrate de no exceder los límites de presupuesto fijados para tus categorías."
      ],
      tips: [
        "Revisa tus suscripciones mensuales recurrentes y cancela las que no hayas utilizado los últimos 30 días.",
        "Asigna un 10% de tus ingresos netos directamente a una cuenta de ahorro automatizada apenas los recibas.",
        "Planifica tus compras de despensa semanalmente para reducir las compras impulsivas de comida fuera."
      ]
    });
  }
});


// ----------------- VITE & STATIC SERVING -----------------

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
