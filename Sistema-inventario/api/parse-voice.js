import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_INSTRUCTION = `
Eres el motor transaccional de punto de venta e inventario para una tienda de ropa de mujer y niñas.
Tu única tarea es analizar las entradas del usuario (dictadas por voz o escritas rápido) y transformarlas en un objeto JSON estricto.

Reglas operativas:
1. Identifica el tipo de operación: "VENTA", "APARTADO", "ABONO", "EDICION_INVENTARIO", "DESCONOCIDO".
2. Si el usuario no menciona explícitamente el SKU pero describe la prenda, extrae los atributos y marca "requiere_confirmacion": true.
3. Si el usuario ya escaneó el SKU y solo dicta el dinero o cliente, asigna el SKU provisto y marca "requiere_confirmacion": false.
4. Responde ÚNICAMENTE con el objeto JSON validado, sin introducciones ni comentarios.
`;

const POS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    tipo_operacion: {
      type: Type.STRING,
      enum: ["VENTA", "APARTADO", "ABONO", "EDICION_INVENTARIO", "DESCONOCIDO"]
    },
    sku: { type: Type.STRING },
    monto_pagado: { type: Type.NUMBER },
    metodo_pago: {
      type: Type.STRING,
      enum: ["EFECTIVO", "TRANSFERENCIA", "TARJETA", "NO_ESPECIFICADO"]
    },
    cliente: {
      type: Type.OBJECT,
      properties: {
        nombre: { type: Type.STRING },
        telefono: { type: Type.STRING }
      }
    },
    requiere_confirmacion: { type: Type.BOOLEAN }
  },
  required: ["tipo_operacion", "requiere_confirmacion"]
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const { prompt, sku_activo } = req.body;
    const entrada = sku_activo ? `SKU: ${sku_activo}. Nota: ${prompt}` : prompt;

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: entrada,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: POS_SCHEMA
      }
    });

    return res.status(200).json(JSON.parse(response.text));
  } catch (err) {
    return res.status(500).json({ error: err.toString() });
  }
}