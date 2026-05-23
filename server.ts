import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Helper to retrieve all book JSON files dynamically from /data/ subdirectories on the filesystem
function getAllBooks(): any[] {
  const dataRootDir = path.join(process.cwd(), "data");
  const booksData: any[] = [];

  if (!fs.existsSync(dataRootDir)) {
    return booksData;
  }

  try {
    const categories = fs.readdirSync(dataRootDir, { withFileTypes: true });

    for (const cat of categories) {
      if (cat.isDirectory()) {
        const categoryPath = path.join(dataRootDir, cat.name);
        if (fs.existsSync(categoryPath)) {
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
  } catch (error) {
    console.error("Error reading data folder directory:", error);
  }

  return booksData;
}

// Intercept page viewer requests and inject custom meta-data & schemas for SEO (Requirement 1, 2, 7)
async function serveSpaWithSeo(req: express.Request, res: express.Response, htmlPath: string, viteInstance?: any) {
  try {
    let resolvedHtmlPath = htmlPath;
    if (!fs.existsSync(resolvedHtmlPath)) {
      const rootHtml = path.join(process.cwd(), "index.html");
      if (fs.existsSync(rootHtml)) {
        resolvedHtmlPath = rootHtml;
      } else {
        // Fallback simple HTML string to prevent ANY file structure crashes on cold-starts in Vercel
        console.warn(`HTML file not found at ${htmlPath} or ${rootHtml}. Serving dynamic fallback HTML.`);
        const titleFallback = "بستان المعرفة | شجرة الحكمة التفاعلية";
        const descFallback = "تأمل خلاصة كتب النفس وتطوير الذات بطريقة شجرية تفاعلية جذابة في بستان المعرفة.";
        return res.send(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titleFallback}</title>
  <meta name="description" content="${descFallback}" />
  <style>
    body { font-family: sans-serif; background-color: #0c101b; color: #f8fafc; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; text-align: center; }
    .card { max-width: 600px; padding: 2.5rem; border-radius: 1.5rem; background-color: #111827; border: 1px solid #1f2937; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3); }
    h1 { color: #38bdf8; font-weight: bold; margin-bottom: 1.5rem; font-size: 2rem; }
    p { font-size: 1.125rem; line-height: 1.75; color: #9ca3af; }
    button { background-color: #38bdf8; color: #030712; border: none; padding: 0.75rem 1.5rem; border-radius: 0.75rem; cursor: pointer; font-weight: bold; font-size: 1rem; margin-top: 1.5rem; transition: background 0.2s; }
    button:hover { background-color: #0ea5e9; }
  </style>
</head>
<body>
  <div class="card">
    <h1>بستان المعرفة</h1>
    <p>مرحباً بك يا صديقي في بستان الحكمة التفاعلي. بوابات البستان مشرعة بسلام وجارٍ تنشيط مهارات التدبر...</p>
    <button onclick="window.location.reload()">دخول بستان الحكمة</button>
  </div>
</body>
</html>`);
      }
    }

    let html = fs.readFileSync(resolvedHtmlPath, "utf-8");

    if (viteInstance) {
      html = await viteInstance.transformIndexHtml(req.originalUrl || req.url, html);
    }

    const parts = req.path.split("/").filter(Boolean);
    let title = "بستان المعرفة | شجرة معرفة تفاعلية لتأمل كتب تطوير الذات";
    let description = "تأمل خلاصة كتب النفس وتطوير الذات بطريقة شجرية تفاعلية جذابة في بستان المعرفة.";
    let jsonLdScripts = "";

    const categoriesList = ["self-development", "psychology", "children", "sociology"];
    const catNames: Record<string, string> = {
      "self-development": "تطوير الذات",
      "psychology": "علم النفس",
      "children": "كتب الأطفال",
      "sociology": "علم الاجتماع",
    };

    if (parts.length === 2) {
      const [category, bookId] = parts;
      const books = getAllBooks();
      const book = books.find((b) => b.id === bookId);
      if (book) {
        title = `ملخص ${book.title} | شجرة معرفة تفاعلية - بستان المعرفة`;
        description = `اكتشف زبدة كتاب ${book.title} ل${book.author} في شجرة تفاعلية. ${book.essence.replace(/"/g, '&quot;')}`;

        const host = req.get("host") || "ais-pre-cg7m4hwtvtfvwsvcysh5db-287964971170.europe-west2.run.app";
        const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
        const bookUrl = `${protocol}://${host}/${category}/${bookId}`;
        const catUrl = `${protocol}://${host}/${category}`;
        const homeUrl = `${protocol}://${host}/`;

        // 1. JSON-LD Book Schema (Requirement 2)
        const bookSchema = {
          "@context": "https://schema.org",
          "@type": "Book",
          "@id": bookUrl,
          "name": book.title,
          "author": {
            "@type": "Person",
            "name": book.author,
          },
          "description": book.essence,
          "genre": catNames[category] || category,
        };

        // 2. JSON-LD BreadcrumbList Schema (Requirement 7)
        const breadcrumbSchema = {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            {
              "@type": "ListItem",
              "position": 1,
              "name": "بستان المعرفة",
              "item": homeUrl,
            },
            {
              "@type": "ListItem",
              "position": 2,
              "name": catNames[category] || category,
              "item": catUrl,
            },
            {
              "@type": "ListItem",
              "position": 3,
              "name": book.title,
              "item": bookUrl,
            },
          ],
        };

        jsonLdScripts = `
    <script type="application/ld+json">
    ${JSON.stringify(bookSchema)}
    </script>
    <script type="application/ld+json">
    ${JSON.stringify(breadcrumbSchema)}
    </script>
        `;
      }
    } else if (parts.length === 1 && categoriesList.includes(parts[0])) {
      const category = parts[0];
      const catName = catNames[category] || category;
      title = `قسم ${catName} | بستان المعرفة`;
      description = `تصفح ملخصات كتب ${catName} على هيئة أشجار تفاعلية ومسارات تأمل ثرية في بستان المعرفة.`;

      const host = req.get("host") || "ais-pre-cg7m4hwtvtfvwsvcysh5db-287964971170.europe-west2.run.app";
      const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
      const catUrl = `${protocol}://${host}/${category}`;
      const homeUrl = `${protocol}://${host}/`;

      const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "بستان المعرفة",
            "item": homeUrl,
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": catName,
            "item": catUrl,
          },
        ],
      };

      jsonLdScripts = `
    <script type="application/ld+json">
    ${JSON.stringify(breadcrumbSchema)}
    </script>
      `;
    }

    if (html.includes("<title>")) {
      html = html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);
    } else {
      html = html.replace("</head>", `<title>${title}</title>\n</head>`);
    }

    const descMetaTag = `<meta name="description" content="${description}" />`;
    if (html.includes('<meta name="description"')) {
      html = html.replace(/<meta name="description"[^>]*>/, descMetaTag);
    } else {
      html = html.replace("</head>", `${descMetaTag}\n</head>`);
    }

    if (jsonLdScripts) {
      html = html.replace("</head>", `${jsonLdScripts}\n</head>`);
    }

    res.send(html);
  } catch (error) {
    console.error("Error serving SPA with SEO:", error);
    try {
      if (fs.existsSync(htmlPath)) {
        res.sendFile(htmlPath);
      } else {
        res.status(500).send("عذراً، حدثت هزة خفيفة في بستان الحكمة أعاقت سقاية الشجرة التفاعلية ريثما تهدأ الريح.");
      }
    } catch (e) {
      res.status(500).send("عذراً، حدث خطأ غير متوقع.");
    }
  }
}

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

const app = express();
app.use(express.json());

  // 0. API: Dynamically retrieve all book JSON files from the subdirectories under /data/
  app.get("/api/books", async (req, res) => {
    try {
      const booksData = getAllBooks();
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

  // Sitemap.xml (Requirement 3)
  app.get("/sitemap.xml", (req, res) => {
    try {
      const host = req.get("host") || "ais-pre-cg7m4hwtvtfvwsvcysh5db-287964971170.europe-west2.run.app";
      const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
      const baseUrl = `${protocol}://${host}`;

      const categories = ["self-development", "psychology", "children", "sociology"];
      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

      // Home
      xml += `  <url>\n    <loc>${baseUrl}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;

      // Categories
      categories.forEach(cat => {
        xml += `  <url>\n    <loc>${baseUrl}/${cat}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
      });

      // Books
      const booksList = getAllBooks();
      booksList.forEach(book => {
        const cat = book.category || "self-development";
        xml += `  <url>\n    <loc>${baseUrl}/${cat}/${book.id}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>\n`;
      });

      xml += `</urlset>`;
      res.header("Content-Type", "application/xml");
      res.send(xml);
    } catch (e: any) {
      console.error("Error generating sitemap.xml:", e);
      res.status(500).send("Error generating sitemap");
    }
  });

  // Robots.txt (Requirement 6)
  app.get("/robots.txt", (req, res) => {
    try {
      const host = req.get("host") || "ais-pre-cg7m4hwtvtfvwsvcysh5db-287964971170.europe-west2.run.app";
      const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
      const baseUrl = `${protocol}://${host}`;

      res.header("Content-Type", "text/plain");
      res.send(`User-agent: *\nAllow: /\nSitemap: ${baseUrl}/sitemap.xml\n`);
    } catch (e: any) {
      res.status(500).send("Error generating robots.txt");
    }
  });

  // 3. Vite development vs static production server integration
  if (process.env.NODE_ENV !== "production") {
    const setupVite = async () => {
      try {
        const vitePkg = "vite";
        const { createServer: createViteServer } = await import(vitePkg);
        const vite = await createViteServer({
          server: { middlewareMode: true },
          appType: "spa",
        });

        // Intercept page views for dev meta tag insertion
        app.get("*", async (req, res, next) => {
          const isHtmlRequest = req.headers.accept?.includes("text/html");
          if (!isHtmlRequest || req.path.startsWith("/api/") || req.path === "/sitemap.xml" || req.path === "/robots.txt") {
            return next();
          }
          try {
            await serveSpaWithSeo(req, res, path.join(process.cwd(), "index.html"), vite);
          } catch (e) {
            next(e);
          }
        });

        app.use(vite.middlewares);
      } catch (err) {
        console.error("Error setting up Vite development server:", err);
      }
    };
    setupVite();
  } else {
    // Production: setup routes 100% synchronously so serverless functions never encounter event-loop initialization races
    const distPath = path.join(process.cwd(), "dist");
    
    // Serve static files, but bypass index.html so our custom wildcard route can inject meta tags
    app.use(express.static(distPath, { index: false }));

    app.get("*", async (req, res) => {
      const isHtmlRequest = req.headers.accept?.includes("text/html") || req.path === "/";
      if (!isHtmlRequest || req.path.startsWith("/api/") || req.path === "/sitemap.xml" || req.path === "/robots.txt") {
        const filePath = path.join(distPath, req.path);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          return res.sendFile(filePath);
        }
      }
      await serveSpaWithSeo(req, res, path.join(distPath, "index.html"));
    });
  }

  if (!process.env.VERCEL) {
    const PORT = Number(process.env.PORT) || 3000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[حكيم البستان] بوابات بستان الحكمة مشرعة بسلام على المرفأ: http://localhost:${PORT}`);
    });
  }

  export default app;
