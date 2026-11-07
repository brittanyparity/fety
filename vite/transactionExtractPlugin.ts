import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

type ExtractPayload = {
  imageDataUrl?: string;
  mimeType?: string;
};

function readJsonBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk as Buffer));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: object) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

const EXTRACT_SCHEMA_HINT = `Return JSON only (no markdown) with:
- desc?: string
- amount?: number (positive magnitude)
- dateISO?: string (YYYY-MM-DD)
- type?: "expense" | "income" | "transfer"
- category?: string
- notes?: string
- confidence: "high" | "medium" | "low"
- uncertainFields: string[] (field names you could not read confidently)

Do not guess missing amounts or dates — omit them and list the field name in uncertainFields.`;

export function transactionExtractPlugin(): Plugin {
  return {
    name: "transaction-extract-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== "POST" || req.url?.split("?")[0] !== "/api/transaction-extract") {
          return next();
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          sendJson(res, 501, { error: "Picture reader is not configured on this server." });
          return;
        }

        try {
          const raw = await readJsonBody(req);
          const payload = JSON.parse(raw || "{}") as ExtractPayload;
          const imageDataUrl = payload.imageDataUrl?.trim();
          if (!imageDataUrl?.startsWith("data:image/")) {
            sendJson(res, 400, { error: "Please upload a valid image file." });
            return;
          }

          const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              temperature: 0,
              response_format: { type: "json_object" },
              messages: [
                {
                  role: "system",
                  content: `You read financial receipt and confirmation images for a budgeting app. ${EXTRACT_SCHEMA_HINT}`,
                },
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: "Extract transaction details from this image for the user to review before saving.",
                    },
                    { type: "image_url", image_url: { url: imageDataUrl } },
                  ],
                },
              ],
            }),
          });

          if (!response.ok) {
            sendJson(res, 502, { error: "We could not read that image right now. Try again or enter the transaction manually." });
            return;
          }

          const completion = (await response.json()) as {
            choices?: { message?: { content?: string } }[];
          };
          const content = completion.choices?.[0]?.message?.content;
          if (!content) {
            sendJson(res, 502, { error: "We could not read that image. Try another photo." });
            return;
          }

          const parsed = JSON.parse(content) as Record<string, unknown>;
          const uncertain = Array.isArray(parsed.uncertainFields)
            ? parsed.uncertainFields.filter((x): x is string => typeof x === "string")
            : [];
          const confidence =
            parsed.confidence === "high" || parsed.confidence === "medium" || parsed.confidence === "low"
              ? parsed.confidence
              : "medium";

          sendJson(res, 200, {
            desc: typeof parsed.desc === "string" ? parsed.desc : undefined,
            amount: typeof parsed.amount === "number" && Number.isFinite(parsed.amount) ? parsed.amount : undefined,
            dateISO: typeof parsed.dateISO === "string" ? parsed.dateISO : undefined,
            type:
              parsed.type === "expense" || parsed.type === "income" || parsed.type === "transfer"
                ? parsed.type
                : undefined,
            category: typeof parsed.category === "string" ? parsed.category : undefined,
            notes: typeof parsed.notes === "string" ? parsed.notes : undefined,
            confidence,
            uncertainFields: uncertain,
          });
        } catch {
          sendJson(res, 500, { error: "Something went wrong while reading your picture." });
        }
      });
    },
  };
}
