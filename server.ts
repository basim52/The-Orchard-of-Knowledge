import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Lazy initialization of GoogleGenAI
let aiClient: GoogleGenAI | null = null;

function getAi(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required to bloom this garden.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // 0. API: Dynamically retrieve all book JSON files from the subdirectories under /data/
  app.get("/api/books", async (req, res) => {
    try {
      const dataRootDir = path.join(process.cwd(), "data");
      const booksData = [];

      // Ensure data directory exists
      if (!fs.existsSync(dataRootDir)) {
        fs.mkdirSync(dataRootDir, { recursive: true });
      }

      // Read all categories directories
      const categories = fs.readdirSync(dataRootDir, { withFileTypes: true });

      for (const cat of categories) {
        if (cat.isDirectory()) {
          const categoryPath = path.join(dataRootDir, cat.name);
          const files = fs.readdirSync(categoryPath);

          for (const file of files) {
            if (file.endsWith(".json")) {
              try {
                const filePath = path.join(categoryPath, file);
                const content = fs.readFileSync(filePath, "utf-8");
                const parsed = JSON.parse(content);
                parsed.category = cat.name; // Keep track of the folder category
                booksData.push(parsed);
              } catch (e) {
                console.error(`Error parsing file ${file} in ${cat.name}:`, e);
              }
            }
          }
        } else if (cat.isFile() && cat.name.endsWith(".json")) {
          try {
            const filePath = path.join(dataRootDir, cat.name);
            const content = fs.readFileSync(filePath, "utf-8");
            const parsed = JSON.parse(content);
            parsed.category = "general";
            booksData.push(parsed);
          } catch (e) {
            console.error(`Error parsing file ${cat.name} in data root:`, e);
          }
        }
      }

      res.json(booksData);
    } catch (error: any) {
      console.error("Error loading books directory:", error);
      res.status(500).json({ error: "تعذر قراءة رفوف الكتب من بستان المعرفة.", details: error.message });
    }
  });

  // 1. API: Custom book summary generation
  app.post("/api/gemini/summary", async (req, res) => {
    try {
      const { title, author } = req.body;
      if (!title) {
        return res.status(400).json({ error: "اسم الشجرة (الكتاب) مطلوب يا صديقي." });
      }

      const ai = getAi();
      const prompt = `أريد تلخيص كتاب: "${title}" ${author ? `من تأليف "${author}"` : ""}. 
أنت الآن "حكيم البستان"، مرشد لطيف يقدم ملخصات طبيعية شاعريّة تفاعليّة تسلط الضوء على فكر تطوير الذات. صمّم الملخص بدقة وفق النموذج الهيكلي المناسب لبستان الحكمة.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: `أنت "حكيم البستان"، مرشد التنمية الذاتية الشاعري. صغ ملخصاً تفاعلياً عميقاً بأسلوب شاعري يسير كالنهر الرائب، ويدور بالكامل حول مجازات الطبيعة (مساقط البذور، سقيا الجذور، تجدد الفصول، صلابة الجذع). تخلّ تماماً عن الأرقام والنقاط العلمية الجافة والعبارات التسويقية.
يجب أن ترتّب المخرجات بمساقط البستان كما يلي بصيغة JSON حقيقية:
- treeName (اسم شاعري يقابل فكرة الكتاب الأساسية بأسلوب البستان، مثلاً "شجرة الرعاية اليومية" أو "نهر اليقظة الدافئ")
- foundationSoil (وصف تربة الأساس التي يرتكز عليها الكتاب فكرياً ووجدانياً)
- branches (قائمة فروع وأوراق الشجرة، تحتوي بالضبط على من 3 إلى 4 فروع. كل فرع لديه: title اسم شاعري وعميق للفرع، description فكرة الفرع مفصلة ومروية بجمال، contemplativeQuestion سؤال تأملي دافق يحث القارئ على التدبر في حياته الشخصية بأسلوب الحكيم)
- fruits (قائمة ثمار المعرفة الخالصة التي يجنيها الساعي، تحتوي من 2 إلى 4 حِكَم ممتازة وصياغتها شاعرية جداً)
- initialQuestion (سؤال تأملي أولي لافت، يطرحه الحكيم للترحيب بالرفيق وبدء حواره في بستان هذه الحكمة الدافئة، مخاطباً إياه بلطف: "يا صديقي" أو "يا متدبر المرج وبستان المعرفة".)`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              treeName: {
                type: Type.STRING,
                description: "Poetic name for the tree of wisdom corresponding to the book's core title, in beautiful Arabic.",
              },
              foundationSoil: {
                type: Type.STRING,
                description: "Deep, beautiful explanation of the foundational core values/ideas of the book metaphorized as nutrient-rich soil, in Arabic.",
              },
              branches: {
                type: Type.ARRAY,
                description: "The 3 to 4 major chapters or concepts of the book, structured as branches.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING, description: "Poetic, metaphorical name of this branch of wisdom in Arabic." },
                    description: { type: Type.STRING, description: "Gentle narrative and clear explanation of this concept in beautiful metaphorical Arabic." },
                    contemplativeQuestion: { type: Type.STRING, description: "A touching, deeply reflective question from Hakim Al-Bustan specifically addressing the user's life relative to this root, in Arabic." },
                  },
                  required: ["title", "description", "contemplativeQuestion"],
                },
              },
              fruits: {
                type: Type.ARRAY,
                description: "The harvested fruits or key actionable takeaways from the book, styled as proverbs, in Arabic.",
                items: { type: Type.STRING },
              },
              initialQuestion: {
                type: Type.STRING,
                description: "A gorgeous, opening welcoming question from Hakim Al-Bustan about this book to invite the user to start their interactive reflection journal.",
              },
            },
            required: ["treeName", "foundationSoil", "branches", "fruits", "initialQuestion"],
          },
        },
      });

      const responseText = response.text || "{}";
      const summaryData = JSON.parse(responseText.trim());
      res.json(summaryData);
    } catch (error: any) {
      console.error("Error generating book summary:", error);
      res.status(500).json({
        error: "عذراً يا صديقي، حدثت هزة في أغصان بستاننا حالت دون استخلاص الثمرة المطلوبة. هل تعيد المحاولة ريثما تهدأ الريح؟",
        details: error.message,
      });
    }
  });

  // 2. API: Chat dialogue with Hakim Al-Bustan
  app.post("/api/gemini/chat", async (req, res) => {
    try {
      const { bookTitle, bookSummary, messages, userMessage } = req.body;
      if (!userMessage) {
        return res.status(400).json({ error: "لا يمكن للحكيم قراءة الصمت؛ أرسل كلماتك يا رفيقي." });
      }

      const ai = getAi();

      // Core system message outlining Hakim's persona and context
      const systemInstruction = `أنت "حكيم البستان"، مرشد تربية النفوس وبستاني الفكر الحنون العطوف. أسلوبك رقيق غاية الهدوء، كالغيم والماء الساري، يغلب عليه استخدام مجازات الطبيعة (التربة، البذرة، الجذر، الفرع العتيق، أزهار الوئام، تساقط الورق، شمس اليقظة، تبدل الفصول).
مهمتك الحالية: استقبال مشاركة أو تأمل صديقك وجوابه عن السؤال الذي طرحه بستان الحكمة حول كتاب: "${bookTitle}".
ملخص بستان المعرفة لهذا الكتاب كالتالي:
- اسم الشجرة: ${bookSummary?.treeName || "شجرة الحكمة"}
- تربة التأسيس: ${bookSummary?.foundationSoil || ""}
- الفروع الرئيسية والأسئلة التأملية: ${JSON.stringify(bookSummary?.branches || [])}

التوجيهات الصارمة لإجابتك:
- تكلّم بلغة عربيّة فصيحة، بالغة العذوبة والسهولة. لا تنساق وراء أي لهجات أو ألفاظ جافة أو مصطلحات أجنبية.
- خاطب السائل بضمير المخاطب المفرد المذكر بلطف وحميمية بالغة ("تأمل يا رفيقي"، "يا صديقي الساعي"، "بستانك يزكو اليوم بمشاركتك هذه").
- طمئن روع السالم، وامسح بكلمات السكينة على حيرته، واحتفل بصدقه وأي تقدم يسير يظهره. البستان ملاذ آمن للروح والقلب بالدرجة الأولى.
- قم بتقييم عمق وصدق مساهمة الرفيق: هل كتب تأمّلاً شخصياً ملامساً لحياته؟ هل بذل مجهوداً في التفكير الحقيقي والاعتراف بالخطأ الطيِّب وتغيير ذاته؟
  - إذا عبّر عن تأمل دافئ وصدق دقيق، اختر "blooms_a_flower" لنهديه زهرة وارفة تفوح بالجمال تفخر بمسيره.
  - إذا شارك مساهمة عادية جيدة ولكنها متواضعة النمو، اختر "grows_a_little" لتنمو شتلته قليلاً.
  - إذا قال شيئاً مقتضباً جداً ومستعجلاً لا يبين صدقاً أو تحركاً، اختر "no_change".

أخرج النتيجة بصيغة JSON حقيقية ومحكمة ومطابقة للمواصفات التالية:
- reply (الرد الشاعري الداكن المليء بالحنان من حكيم البستان، يعقب فيه على ما قاله الصديق، ويهدئ روعه، ويفسر كلامه بجمل من البستان الرائع الشفاف)
- reflectionProgressUpdate (يجب أن تكون حصراً إحدى الثلاث قيم: "no_change" أو "grows_a_little" أو "blooms_a_flower")
- nextReflectiveQuestion (سؤال تفكري وتأملي جديد، ينبثق كقطرة ندى تالية تداعب روحه بخصوص خطوة عملية تالية يمارسها، أو تطلب منه التوسع في جانبه الروحي)`;

      // Build dialog contents with system context
      const contents = messages.map((m: any) => ({
        role: m.sender === "user" ? "user" : "model",
        parts: [{ text: m.text }],
      }));

      // Append last message
      contents.push({
        role: "user",
        parts: [{ text: userMessage }],
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contents,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: {
                type: Type.STRING,
                description: "Poetic, gentle, and metaphorical response from Hakim Al-Bustan commenting on user reflection, in Arabic.",
              },
              reflectionProgressUpdate: {
                type: Type.STRING,
                enum: ["no_change", "grows_a_little", "blooms_a_flower"],
                description: "Evaluation of the depth of user reflection. returns 'no_change', 'grows_a_little', or 'blooms_a_flower'.",
              },
              nextReflectiveQuestion: {
                type: Type.STRING,
                description: "A continuous nourishing fresh question to continue the journey, in Arabic.",
              },
            },
            required: ["reply", "reflectionProgressUpdate", "nextReflectiveQuestion"],
          },
        },
      });

      const responseText = response.text || "{}";
      const replyData = JSON.parse(responseText.trim());
      res.json(replyData);
    } catch (error: any) {
      console.error("Error in chat service:", error);
      res.status(500).json({
        error: "اعتذر الحكيم بلطف، فقد حالت حفيف أوراق البستان دون سماع صوتك بصورة واضحة. هل تعيد ري كلماتك يا رفيقي؟",
        details: error.message,
      });
    }
  });

  // 3. Vite development vs static production server integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[حكيم البستان] بوابات بستان الحكمة مشرعة بسلام على المرفأ: http://localhost:${PORT}`);
  });
}

startServer();
