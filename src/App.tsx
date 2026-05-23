import React, { useState, useEffect } from 'react';
import { 
  Book, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Check, 
  Plus, 
  ArrowRight, 
  Bookmark, 
  Award, 
  Calendar, 
  Compass, 
  BookOpen, 
  RefreshCw,
  Info
} from 'lucide-react';
import { BookData, LeafDetail } from './types';
import { BACKUP_BOOKS } from './defaultBooks';
import BookTree from './components/BookTree';
import ConsciousnessMap from './components/ConsciousnessMap';

export default function App() {
  const [books, setBooks] = useState<BookData[]>(BACKUP_BOOKS);
  const [selectedCategory, setSelectedCategory] = useState<string>('self-development');
  const [selectedBook, setSelectedBook] = useState<BookData | null>(null);
  const [view, setView] = useState<'home' | 'tree'>('home');
  const [activeTab, setActiveTab] = useState<'tree' | 'consciousness-map' | 'challenges' | 'spoils'>('tree');

  // Filtered books compiled on active selected category
  const filteredBooks = selectedCategory === 'all'
    ? books
    : books.filter(b => (b.category || 'self-development') === selectedCategory);

  // Selected Leaf details for side panel
  const [selectedLeaf, setSelectedLeaf] = useState<LeafDetail | null>(null);
  const [activeBranch, setActiveBranch] = useState<string>('');

  // Planting Custom Seed State
  const [seedTitle, setSeedTitle] = useState('');
  const [seedAuthor, setSeedAuthor] = useState('');
  const [isPlanting, setIsPlanting] = useState(false);
  const [plantingError, setPlantingError] = useState('');

  // User Reflections & Challenge states (persist to localStorage)
  const [completedChallenges, setCompletedChallenges] = useState<Record<string, string[]>>({}); // bookId -> completedDays[]
  const [reflections, setReflections] = useState<Record<string, { leafName: string, text: string, date: string }[]>>({}); // bookId -> logs
  const [currentReflectionText, setCurrentReflectionText] = useState('');
  const [reflectionNotice, setReflectionNotice] = useState('');

  // Unlocked Spoils (Quotes) per book
  const [unlockedLevel, setUnlockedLevel] = useState<Record<string, number>>({}); // bookId -> number of unlocked quotes index

  // Attempt to fetch books from backend on startup, fallback to backups
  useEffect(() => {
    async function loadBooks() {
      try {
        const res = await fetch('/api/books');
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            setBooks(data);
          }
        }
      } catch (e) {
        console.warn('API /api/books failed, falling back to static database gracefully.', e);
      }
    }
    loadBooks();
  }, []);

  // Pre-load from local storage
  useEffect(() => {
    const savedChallenges = localStorage.getItem('garden_challenges');
    const savedReflections = localStorage.getItem('garden_reflections');
    const savedUnlocked = localStorage.getItem('garden_unlocked_quotes');

    if (savedChallenges) setCompletedChallenges(JSON.parse(savedChallenges));
    if (savedReflections) setReflections(JSON.parse(savedReflections));
    if (savedUnlocked) setUnlockedLevel(JSON.parse(savedUnlocked));
  }, []);

  // Sync helpers
  const saveChallenges = (updated: Record<string, string[]>) => {
    setCompletedChallenges(updated);
    localStorage.setItem('garden_challenges', JSON.stringify(updated));
  };

  const saveReflections = (updated: Record<string, { leafName: string, text: string, date: string }[]>) => {
    setReflections(updated);
    localStorage.setItem('garden_reflections', JSON.stringify(updated));
  };

  const saveUnlocked = (updated: Record<string, number>) => {
    setUnlockedLevel(updated);
    localStorage.setItem('garden_unlocked_quotes', JSON.stringify(updated));
  };

  // Navigations
  const handleSelectBook = (book: BookData) => {
    setSelectedBook(book);
    setView('tree');
    setActiveTab('tree');
    setSelectedLeaf(null);
    setCurrentReflectionText('');
    setReflectionNotice('');
  };

  const handleBackToGarden = () => {
    setView('home');
    setSelectedBook(null);
    setSelectedLeaf(null);
  };

  // Click leaf in D3 Tree
  const handleLeafClick = (leaf: LeafDetail, branchName: string) => {
    setSelectedLeaf(leaf);
    setActiveBranch(branchName);
    
    // Pre-load existing reflection if any
    const bookReconstructLogs = reflections[selectedBook?.id || ''] || [];
    const priorLog = bookReconstructLogs.find(l => l.leafName === leaf.name);
    setCurrentReflectionText(priorLog ? priorLog.text : '');
    setReflectionNotice('');
  };

  // Save Reflection Note to Journal
  const handleSaveReflection = () => {
    if (!selectedBook || !selectedLeaf) return;
    if (!currentReflectionText.trim()) {
      setReflectionNotice('فضلاً اكتب شيئاً يسيراً من تأملك لتغذية جذور الشجرة.');
      return;
    }

    const bookId = selectedBook.id;
    const currentLogs = reflections[bookId] || [];
    
    // Filter out prior entry
    const filtered = currentLogs.filter(l => l.leafName !== selectedLeaf.name);
    const newLog = {
      leafName: selectedLeaf.name,
      text: currentReflectionText,
      date: new Date().toLocaleDateString('ar-SA')
    };

    const updated = {
      ...reflections,
      [bookId]: [...filtered, newLog]
    };

    saveReflections(updated);
    setReflectionNotice('تم تسجيل تأملك ببركة مضافة! حكيم البستان يحيي صدقك ونموك.');

    // Award a Quote if they haven't unlocked much for completing this leaf reflection
    const currentUnlockedCt = unlockedLevel[bookId] || 0;
    const maxQuotes = selectedBook.quotes.length;
    if (currentUnlockedCt < maxQuotes) {
      const updatedUnlocked = {
        ...unlockedLevel,
        [bookId]: Math.min(maxQuotes, currentUnlockedCt + 1)
      };
      saveUnlocked(updatedUnlocked);
    }
  };

  // Toggle Challenge completion state
  const handleToggleChallenge = (dayNumStr: string) => {
    if (!selectedBook) return;
    const bookId = selectedBook.id;
    const currentList = completedChallenges[bookId] || [];

    let updatedList;
    if (currentList.includes(dayNumStr)) {
      updatedList = currentList.filter(d => d !== dayNumStr);
    } else {
      updatedList = [...currentList, dayNumStr];
      
      // Award a Spoils quote on adding a success check!
      const currentUnlockedCt = unlockedLevel[bookId] || 0;
      const maxQuotes = selectedBook.quotes.length;
      if (currentUnlockedCt < maxQuotes) {
        const updatedUnlocked = {
          ...unlockedLevel,
          [bookId]: Math.min(maxQuotes, currentUnlockedCt + 1)
        };
        saveUnlocked(updatedUnlocked);
      }
    }

    const updated = {
      ...completedChallenges,
      [bookId]: updatedList
    };
    saveChallenges(updated);
  };

  // Gemini: Plant Custom Seed Summary
  const handlePlantSeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seedTitle.trim()) {
      setPlantingError('فضلاً اكتب اسم الكتاب أو شجرة المعرفة التي تطرح بذورها.');
      return;
    }

    setIsPlanting(true);
    setPlantingError('');

    try {
      const response = await fetch('/api/gemini/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: seedTitle, author: seedAuthor })
      });

      if (!response.ok) {
        throw new Error('حدثت مشكلة أثناء استدعاء حبر البستان الخالد.');
      }

      const resData = await response.json();

      // Transform AI response into a high-fidelity BookData
      const mappedBook: BookData = {
        id: `custom-${Date.now()}`,
        title: seedTitle,
        author: seedAuthor || "مرشد البستان الذاتي",
        cover: "bg-teal-800 text-teal-100 border-teal-950", // Dedicated gorgeous custom book color
        essence: resData.foundationSoil || "جوهر الحكمة قائم على تأمل الذات وتطهير البواطن.",
        mindsetShifts: resData.fruits && resData.fruits.length > 0 ? resData.fruits : [
          "تعديل التفكير يبدأ من الاعتراف بما يتراكم بالباطن.",
          "زراعة عادات الصغار خير من السعي المفرط للأوهام السريعة."
        ],
        trunk: resData.treeName || `شجرة ${seedTitle}`,
        branches: resData.branches && resData.branches.length > 0 
          ? resData.branches.map((b: any, idx: number) => ({
              name: b.title || `الغصن ${idx + 1}`,
              leaves: [
                {
                  name: `رواء حكمة ${b.title || 'العقل'}`,
                  explanation: b.description || 'توضيح ملموس للفكرة الروحية للكتاب.',
                  example: 'تطبيق يومي في مجرى العائلة والعمل لزكاة النفس.',
                  contemplation: b.contemplativeQuestion || 'ما هي الخطوة اليقظة التالية في ثنايا أسبوعك؟'
                }
              ]
            }))
          : [
              {
                name: "ورقة الفهم والتحرك",
                leaves: [
                  {
                    name: "رعاية غرس الفكر",
                    explanation: "إن إدراك شجرة المعرفة هذه يتطلب تسليماً عميقاً بحاجة النفس للتطوير المستمر.",
                    example: "القراءة ببطء وكتابة تأملاتك بالبستان.",
                    contemplation: "ما الأثر الطيّب الذي ترجو تلمّسه بعد زراعتك لهذه الشتلة الفكرية؟"
                  }
                ]
              }
            ],
        hasConsciousnessMap: false,
        challenges: [
          `اليوم 1: تأمل في تيجان وعي بستاننا الجديد: ${seedTitle} لستين ثانية متصلة.`,
          "اليوم 2: دوّن فكرة واحدة لامست عاطفتك من كلام حكيم بستاننا اللطيف.",
          "اليوم 3: تنفس بعمق وحفز المحيطين بك بابتسام لزكاء المروءة.",
          "اليوم 4: واجه عملاً مؤجلاً واحداً دون إبطاء واقضِ دقيقتين في إنجازه.",
          "اليوم 5: قل في صمت: 'أنا مستعد لتنمية شتائل بستاني الصغير بصدق وصبر الفلاحين'.",
          "اليوم 6: خصّص بعض الدقائق للتواصل الروحي الهادئ وكف عن لوم الظروف.",
          "اليوم 7: استنشق عبير هذا النماء، وتجول بخفة ومودة مطلقة في أرجاء حياتك الكريمة."
        ],
        quotes: [
          `سقيا المعرفة لشجرة "${seedTitle}" تثمر هدوءاً ونورانية تبدد وحشة الدروب الغائمة.`,
          "النبتة الصغيرة التي ترويها بدم التزامك اليومي، تصبح غداً غابة ظليلة تحميك من لهيب الصراعات."
        ]
      };

      // Set state and select it immediately!
      setBooks([mappedBook, ...books]);
      setSelectedBook(mappedBook);
      setSeedTitle('');
      setSeedAuthor('');
      setView('tree');
      setActiveTab('tree');
      setSelectedLeaf(null);
      
    } catch (err: any) {
      setPlantingError('عذراً يارفيقي؛ هبّت عاصفة عابرة أعاقت زراعة بذرتك في الخادم. هلاّ جربت العنوان من جديد؟');
    } finally {
      setIsPlanting(false);
    }
  };

  // Compute stats for current selected book
  const bookId = selectedBook?.id || '';
  const completedChCt = completedChallenges[bookId]?.length || 0;
  const reflectionsCt = reflections[bookId]?.length || 0;
  const quotesUnlocked = unlockedLevel[bookId] || 0;

  return (
    <div className="min-h-screen bg-[#fcfbf7] font-sans antialiased text-[#2c3531] flex flex-col justify-between">
      
      {/* 1. TOP BRAND HEADER */}
      <header className="bg-white/85 backdrop-blur-md border-b border-emerald-100/40 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-700 flex items-center justify-center text-white shadow-xs">
              <span className="text-xl">🌳</span>
            </div>
            <div>
              <h1 className="text-lg font-serif font-black text-emerald-950 flex items-center gap-1">
                بستان المعرفة
              </h1>
              <p className="text-[10px] text-emerald-800/80 -mt-1 font-serif">مرشدك التفاعلي لتأمل وتطوير الذات</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {view === 'tree' && (
              <button 
                onClick={handleBackToGarden}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-serif font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-100/50 cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
                <span>العودة للبستان</span>
              </button>
            )}
            <span className="text-xs bg-slate-100 px-2.5 py-1 rounded-full text-slate-600 font-serif hidden md:inline">
              مرشد البستان: حكيم اليقظة
            </span>
          </div>
        </div>
      </header>

      {/* 2. CORE CONTENT AREA */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 md:px-8 py-8">
        
        {view === 'home' ? (
          /* =======================================
             HOMEPAGE: BOOKSHELF & SEED PLANTING
             ======================================= */
          <div className="space-y-10">
            
            {/* Main Header & Horizontal Navigation Bar */}
            <div className="text-center space-y-6 pt-2 pb-2">
              <div className="space-y-2">
                <h2 className="text-4xl md:text-5xl font-serif font-black text-emerald-950 tracking-tight">
                  بستان المعرفة
                </h2>
                <p className="text-emerald-800/80 text-sm md:text-base font-serif font-medium">
                  اختر قسمك لتبدأ الرحلة
                </p>
              </div>

              {/* Horizontal Category Navigation */}
              <div className="flex justify-center items-center">
                <div className="w-full max-w-2xl bg-white rounded-2xl border border-emerald-100/60 p-1.5 shadow-xs flex gap-1 justify-between">
                  {[
                    { id: 'self-development', label: 'تطوير الذات', icon: '🍃' },
                    { id: 'psychology', label: 'علم نفس', icon: '🧠' },
                    { id: 'sociology', label: 'علم اجتماع', icon: '👥' },
                    { id: 'children', label: 'أطفال', icon: '🧸' }
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-2 sm:px-4 rounded-xl font-serif font-bold text-xs sm:text-sm border transition-all duration-300 transform active:scale-95 cursor-pointer ${
                        selectedCategory === cat.id
                          ? 'bg-emerald-800 text-white border-emerald-950 shadow-md shadow-emerald-800/20'
                          : 'bg-transparent text-slate-600 border-transparent hover:bg-emerald-50 hover:text-emerald-800'
                      }`}
                    >
                      <span className="text-sm sm:text-base">{cat.icon}</span>
                      <span>{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Poetical Greeting Banner */}
            <section className="bg-gradient-to-br from-emerald-800 to-teal-900 text-emerald-50 rounded-3xl p-6 md:p-12 shadow-md relative overflow-hidden">
              <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-2xl"></div>
              <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-700/10 rounded-full blur-3xl"></div>
              
              <div className="relative z-10 max-w-2xl space-y-4">
                <span className="bg-emerald-700/60 border border-emerald-400/20 text-xs px-3 py-1 rounded-full font-serif font-bold text-yellow-100">
                  تأمل مستوحى من الطبيعة وتطوير الذات
                </span>
                <h2 className="text-2xl md:text-4xl font-serif font-black !leading-tight text-white">
                  أهلاً بك يا رفيقي في "بستان المعرفة"، ملاذ الخفة والسلام
                </h2>
                <p className="text-[#dbefe4] text-sm md:text-base leading-relaxed font-serif">
                  "تخلَّ عن عواصف التشتت، واجلس إليّ في مروج الحكمة الغضة. كل كتاب هنا شجرة حية؛ سقياها صدق تأملاتك، وهديتها ثمار السكينة والخفة التي تبدد عناء النفس الطويل."
                </p>
                <div className="flex items-center gap-2 text-xs md:text-sm text-yellow-200 font-bold font-serif pt-2">
                  <span>🍃</span>
                  <span>تأمل كيف تتساقط أوهام الكبرياء لتنبت بذور الصدق والشجاعة من جديد...</span>
                </div>
              </div>
            </section>

            {/* THE WOODEN BOOKSHELF */}
            <section className="space-y-6">
              <div className="flex justify-between items-end border-b border-emerald-100/40 pb-3">
                <div>
                  <h3 className="text-xl md:text-2xl font-serif font-black text-slate-800">
                    رف الحكمة الخشبي
                  </h3>
                  <p className="text-slate-400 text-xs">اختر كتابك لتبدأ في مرافقة أغصانه واستخراج أوراقه الذاتية</p>
                </div>
                <span className="text-xs text-slate-500 font-mono">الكتب المتوفرة: {filteredBooks.length}</span>
              </div>

              {/* Wooden Board Stylized Shelf */}
              <div className="relative bg-amber-50 rounded-2xl border border-amber-200/40 p-6 md:p-8 shadow-inner overflow-hidden">
                <div className="absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-amber-700 to-amber-900 opacity-90 rounded-b-xl"></div>
                
                {/* Book Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6 md:gap-8 pb-4 relative z-10">
                  {filteredBooks.map((book) => (
                    <div 
                      key={book.id}
                      onClick={() => handleSelectBook(book)}
                      className="group cursor-pointer flex flex-col justify-between"
                    >
                      {/* Stylized Standing Book Widget */}
                      <div className={`aspect-[3/4] rounded-r-2xl rounded-l-xs shadow-lg hover:shadow-2xl hover:-translate-y-3 transition-all duration-300 border-r-8 relative overflow-hidden flex flex-col justify-between p-4 ${book.cover}`}>
                        {/* Book Spine Golden Overlay line */}
                        <div className="absolute top-0 right-0 w-1.5 h-full bg-black/15"></div>
                        <div className="absolute top-0 left-0 w-full h-1 bg-white/10"></div>
                        
                        {/* Golden Emblem Top */}
                        <div className="flex justify-between items-center opacity-75">
                          <span className="text-xs select-none">🪶</span>
                          <span className="text-[9px] tracking-widest font-mono uppercase">HAKIM</span>
                        </div>

                        {/* Title & Author */}
                        <div className="space-y-1.5 pt-6 text-right">
                          <h4 className="text-sm md:text-base font-serif font-black leading-tight group-hover:text-yellow-100 transition-colors">
                            {book.title}
                          </h4>
                          <p className="text-[10px] opacity-80 font-serif">
                            {book.author}
                          </p>
                        </div>

                        {/* Plant Branch footer indicator */}
                        <div className="flex justify-between items-end border-t border-white/20 pt-2 opacity-60">
                          <span className="text-[8px] font-mono select-none">ACTIVE SEED</span>
                          <span className="text-xs">🌳</span>
                        </div>
                      </div>

                      {/* Beneath book meta */}
                      <p className="text-center font-serif font-bold text-xs text-slate-700 mt-3 group-hover:text-emerald-800 transition-colors">
                        اضغط لفتح الشجرة
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* SEED PLANTING CENTER (GEMINI AI SUMMARIZE) */}
            <section className="bg-white rounded-3xl border border-emerald-100/60 p-6 md:p-8 shadow-xs">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                
                <div className="lg:col-span-6 space-y-4">
                  <div className="inline-flex bg-amber-50 border border-amber-200/50 text-amber-800 text-xs px-3 py-1 rounded-full font-serif font-bold items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>تخليق وافر بالذكاء الاصطناعي</span>
                  </div>
                  <h3 className="text-xl md:text-2xl font-serif font-black text-slate-800">
                    هل ترغب بزراعة شجرة حكمة مخصصة لكتاب جديد؟
                  </h3>
                  <p className="text-slate-500 text-sm leading-relaxed font-serif">
                    إذا كان لديك كتاب آخر في تطوير الذات ترغب في تلخيصه وتوليد "شجرته التفاعلية" مباشرة، فاكتب اسمه واسم مؤلفه هنا. سيقوم حكيم البستان فوراً بتحضير التربة وتخليق فروع الشجرة بالكامل من أجلك.
                  </p>
                  
                  <div className="bg-slate-50 border border-slate-100 text-xs text-slate-400 p-3.5 rounded-xl space-y-1">
                    <p className="font-bold">توضيح للمطورين والمصنعين:</p>
                    <p>
                      الشاشات مبنية بصورة ديناميكية كاملة. لحفظ أو إضافة كتب دائمة على الرف، يمكنك إضافة ملفات JSON بصيغة البنية الموضحة في الكود داخل مجلد <code className="font-mono text-slate-600 bg-slate-100 px-1 rounded-sm">/data/books/</code> مباشرة وسيقوم النظام بالإدراج التلقائي لها.
                    </p>
                  </div>
                </div>

                <div className="lg:col-span-6 bg-[#fcfbf9] rounded-2xl border border-emerald-100/40 p-6 shadow-inner">
                  <form onSubmit={handlePlantSeed} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 font-serif block">اسم الكتاب (شجرة المعرفة)</label>
                      <input 
                        type="text" 
                        value={seedTitle} 
                        onChange={(e) => setSeedTitle(e.target.value)}
                        placeholder="مثال: قوة العقل الباطن، لغات الحب الخمس..." 
                        className="w-full text-sm bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-600 transition-shadow text-slate-800"
                        disabled={isPlanting}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 font-serif block">اسم المؤلف (اختياري)</label>
                      <input 
                        type="text" 
                        value={seedAuthor} 
                        onChange={(e) => setSeedAuthor(e.target.value)}
                        placeholder="مثال: جوزيف ميرفي" 
                        className="w-full text-sm bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-600 transition-shadow text-slate-800"
                        disabled={isPlanting}
                      />
                    </div>

                    {plantingError && (
                      <p className="text-xs text-red-600 font-serif bg-red-50 p-2.5 rounded-lg border border-red-100">
                        {plantingError}
                      </p>
                    )}

                    <button 
                      type="submit"
                      disabled={isPlanting}
                      className="w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-serif font-bold text-sm py-3.5 px-6 rounded-xl transition-colors select-none shadow-xs cursor-pointer"
                    >
                      {isPlanting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>جاري تحضير التربة ورعاية الشتلة بالذكاء الاصطناعي...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>ازرع بذرة هذا الكتاب في البستان</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>

              </div>
            </section>

          </div>
        ) : (
          /* =======================================
             ACTIVE BOOK PAGE: INTERACTIVE TREE
             ======================================= */
          selectedBook && (
            <div className="space-y-8">
              
              {/* Poetic Book Header Banner */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white rounded-3xl border border-emerald-100/50 p-6 md:p-8 gap-4 shadow-xs">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-emerald-800 font-serif font-black">
                    <span>بستان الكتاب</span>
                    <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full"></span>
                    <span>{selectedBook.author}</span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-serif font-black text-emerald-950 flex items-center gap-2">
                    <span>شجرة:</span>
                    <span>{selectedBook.title}</span>
                  </h2>
                </div>

                <div className="flex items-center gap-2 bg-emerald-50/50 border border-emerald-150 px-4 py-2 rounded-2xl text-xs text-emerald-990 font-serif">
                  <span className="font-bold">معدل سقياك:</span>
                  <span>{reflectionsCt} تأمل محرز</span>
                  <span className="opacity-40">|</span>
                  <span>{completedChCt}/7 أيام تحدي</span>
                </div>
              </div>

              {/* BOOK SUMMARY IN 30 SECONDS */}
              <div className="bg-gradient-to-br from-slate-50 to-[#fbfbf9] rounded-3xl border border-slate-200/40 p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 shadow-inner">
                
                <div className="lg:col-span-5 space-y-3 border-l border-slate-200/60 pl-2 lg:pl-6 text-right">
                  <div className="inline-flex bg-slate-100 text-slate-700 text-xs md:text-sm px-3 py-1 rounded-full font-bold">
                    الكتاب في 30 ثانية
                  </div>
                  <h4 className="text-base md:text-lg font-serif font-bold text-slate-800 flex items-center gap-1.5 justify-end">
                    <span>الجوهر الثابت والشفرة للعيش</span>
                    <span>🌾</span>
                  </h4>
                  <p className="text-sm md:text-base text-slate-705 leading-relaxed font-serif bg-white p-4 rounded-xl border border-slate-100">
                    "{selectedBook.essence}"
                  </p>
                </div>

                <div className="lg:col-span-7 space-y-3">
                  <h4 className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-widest text-right">
                    ثلاث وثبات فكرية كبرى للشجرة
                  </h4>
                  <div className="space-y-2.5">
                    {selectedBook.mindsetShifts.slice(0, 3).map((shift, idx) => (
                      <div key={idx} className="flex gap-3 bg-white p-3.5 rounded-xl border border-slate-100/60 text-right items-start">
                        <div className="flex-grow text-xs md:text-sm text-slate-750 font-serif leading-relaxed">
                          {shift}
                        </div>
                        <div className="w-7 h-7 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-800 select-none shrink-0">
                          {idx + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* PAGE SUB TABS */}
              <div className="flex border-b border-slate-200/60 pb-0.5 justify-start md:justify-center overflow-x-auto gap-2.5">
                <button
                  onClick={() => setActiveTab('tree')}
                  className={`py-3 px-5 text-sm font-serif font-bold border-b-2 transition-all shrink-0 cursor-pointer ${
                    activeTab === 'tree' 
                      ? 'border-emerald-700 text-emerald-900 font-black' 
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  🌳 شجرة الفكر والأغصان
                </button>
                
                {selectedBook.hasConsciousnessMap && (
                  <button
                    onClick={() => setActiveTab('consciousness-map')}
                    className={`py-3 px-5 text-sm font-serif font-bold border-b-2 transition-all shrink-0 cursor-pointer ${
                      activeTab === 'consciousness-map' 
                        ? 'border-emerald-700 text-emerald-900 font-black' 
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    📈 مقياس ومسار الوعي
                  </button>
                )}

                <button
                  onClick={() => setActiveTab('challenges')}
                  className={`py-3 px-5 text-sm font-serif font-bold border-b-2 transition-all shrink-0 cursor-pointer ${
                    activeTab === 'challenges' 
                      ? 'border-emerald-700 text-emerald-900 font-black' 
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  📅 تحدي الأيام السبعة (7)
                </button>

                <button
                  onClick={() => setActiveTab('spoils')}
                  className={`py-3 px-5 text-sm font-serif font-bold border-b-2 transition-all shrink-0 cursor-pointer ${
                    activeTab === 'spoils' 
                      ? 'border-emerald-700 text-emerald-900 font-black' 
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  🏆 غنائم المعرفة وحكمتك ({quotesUnlocked})
                </button>
              </div>

              {/* TAB PANEL RENDERING */}
              <div className="min-h-[450px]">
                
                {/* 1. D3 TREE WITH COLLAPSIBLE SIDE PANEL */}
                {activeTab === 'tree' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* The interactive tree container (8 cols on desktop) */}
                    <div className="lg:col-span-8 flex flex-col gap-4">
                      <div className="bg-emerald-50 border border-emerald-100/50 p-4 rounded-2xl text-right">
                        <p className="text-emerald-950 font-serif text-xs leading-relaxed">
                          💡 <strong>توجيه السقيا:</strong> هذه شجرة الحكمة المروية ببيانات دقيقة. انقر على أي ورقة خضراء لتكبيرها، وقراءة تفسيرها ومثالها الحيّ ثم تفويض تأملك الصادق في محضر بستانك الصغير.
                        </p>
                      </div>

                      <BookTree 
                        book={selectedBook} 
                        onLeafClick={handleLeafClick}
                        selectedLeafName={selectedLeaf?.name}
                      />
                    </div>

                    {/* Leaf Detail Sliding Custom Drawer/Panel (4 cols on desktop) */}
                    <div className="lg:col-span-4 transition-all duration-300">
                      {selectedLeaf ? (
                        <div className="bg-[#fcfbf9] rounded-2xl border-2 border-emerald-700/60 p-6 space-y-6 shadow-md relative overflow-hidden">
                          
                          {/* Top Tag */}
                          <div className="flex justify-between items-center text-sm pb-3 border-b border-emerald-100/50">
                            <span className="text-emerald-800 font-serif font-bold">{activeBranch}</span>
                            <span className="bg-emerald-100 text-emerald-900 px-2.5 py-0.5 rounded-sm font-bold text-xs">الورقة المعرفية</span>
                          </div>

                          <div className="space-y-4">
                            <h4 className="text-xl md:text-2xl font-serif font-black text-emerald-950">
                              {selectedLeaf.name}
                            </h4>

                            <div className="space-y-1">
                              <span className="text-xs font-bold text-slate-400 block">التفسير والتبسيط العذب</span>
                              <p className="text-slate-755 text-sm md:text-base leading-relaxed font-serif bg-white p-4 rounded-xl border border-slate-100 shadow-tiny">
                                {selectedLeaf.explanation}
                              </p>
                            </div>

                            <div className="space-y-1">
                              <span className="text-xs font-bold text-slate-400 block">مثال من البستان والحياة</span>
                              <p className="text-emerald-990 text-sm md:text-base font-serif leading-relaxed bg-emerald-50/50 p-4 rounded-xl border border-emerald-100/30">
                                🌿 <em>{selectedLeaf.example}</em>
                              </p>
                            </div>

                            <div className="space-y-2.5 border-t border-slate-100 pt-4">
                              <span className="text-sm font-bold text-blue-800 flex items-center gap-1.5 font-serif">
                                <span>❓</span>
                                <span>سؤال التدبر من حكيم البستان</span>
                              </span>
                              <p className="text-slate-800 text-sm md:text-base font-serif font-bold leading-relaxed">
                                {selectedLeaf.contemplation}
                              </p>

                              {/* Interactive input box for user reflection */}
                              <textarea
                                value={currentReflectionText}
                                onChange={(e) => setCurrentReflectionText(e.target.value)}
                                placeholder="اكتب تدبرك الشخصي بصدق تام هنا يا رفيقي..."
                                className="w-full h-24 text-sm bg-white border border-slate-300 rounded-xl p-3 inline-block focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all text-slate-800"
                              />

                              {reflectionNotice && (
                                <p className="text-xs md:text-sm font-serif text-center bg-yellow-50 text-yellow-905 border border-yellow-100 p-2.5 rounded-lg leading-relaxed">
                                  {reflectionNotice}
                                </p>
                              )}

                              <button
                                onClick={handleSaveReflection}
                                className="w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-serif font-bold text-sm py-3.5 rounded-lg transition-colors shadow-xs hover:shadow-md cursor-pointer select-none"
                              >
                                <Award className="w-4 h-4" />
                                <span>سجّل تأملي في المعبر</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-[#f6f5f0] border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center min-h-[300px] flex flex-col justify-center items-center gap-3">
                          <span className="text-4xl">🌾</span>
                          <h5 className="font-serif font-bold text-slate-700 text-base">لم تختر ورقة بعد</h5>
                          <p className="text-slate-500 text-sm leading-relaxed max-w-[200px]">
                            بستان المعرفة غني بالظلال؛ تفضل بلمس أي ورقة في الشجرة اليسرى لقراءتها.
                          </p>
                        </div>
                      )}
                    </div>

                  </div>
                )}

                {/* 2. CHOSEN CONSCIOUSNESS MAP SUB-SECTION */}
                {activeTab === 'consciousness-map' && selectedBook.hasConsciousnessMap && (
                  <ConsciousnessMap />
                )}

                {/* 3. CHALLENGE DAY BOARD */}
                {activeTab === 'challenges' && (
                  <div className="space-y-6">
                    <div className="bg-amber-50 border border-amber-200/50 p-4 rounded-2xl text-right">
                      <p className="text-amber-950 font-serif text-xs md:text-sm leading-relaxed">
                        📅 <strong>قواعد التحدي اليومي السلوكي:</strong> حاول تأمل وتطبيق المهمة المقابلة في يومك بإنصاف، وعند الانتهاء انقر على الزر الذهبي الشاحب. إنجاز التحديات يذيب الشحنات السلبية ويفصح لك عن غنائم وحِكم جديدة!
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {selectedBook.challenges.map((task, idx) => {
                        const dayLabel = `يوم-${idx + 1}`;
                        const isCompleted = (completedChallenges[selectedBook.id] || []).includes(dayLabel);
                        
                        return (
                          <div 
                            key={idx}
                            className={`bg-white rounded-2xl border p-5 space-y-4 flex flex-col justify-between transition-all duration-300 ${
                              isCompleted 
                                ? 'border-emerald-500 bg-emerald-50/20 shadow-xs scale-[0.98]' 
                                : 'border-slate-100 hover:shadow-md'
                            }`}
                          >
                            <div className="space-y-2 text-right">
                              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-650'
                              }`}>
                                اليوم {idx + 1}
                              </span>
                              <p className="text-xs font-serif text-slate-700 leading-relaxed font-bold">
                                {task}
                              </p>
                            </div>

                            <button
                              onClick={() => handleToggleChallenge(dayLabel)}
                              className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-serif font-bold transition-all duration-300 border cursor-pointer select-none ${
                                isCompleted 
                                  ? 'bg-emerald-600 text-white border-emerald-700' 
                                  : 'bg-[#fafafa] hover:bg-slate-50 text-slate-700 border-slate-200'
                              }`}
                            >
                              {isCompleted ? (
                                <>
                                  <Check className="w-3.5 h-3.5 stroke-2" />
                                  <span>تم الحصاد والإنجاز</span>
                                </>
                              ) : (
                                <>
                                  <Calendar className="w-3.5 h-3.5" />
                                  <span>أنجزت الممارسة اليومية</span>
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 4. DETAILS OF THE KNOWLEDGE SPOILS AND JOURNAL */}
                {activeTab === 'spoils' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* Unlocked Inspiring Quotes (6 cols) */}
                    <div className="lg:col-span-6 bg-white rounded-2xl border border-emerald-100/40 p-6 space-y-6 text-right shadow-xs">
                      <div className="border-b border-emerald-100/50 pb-3">
                        <h4 className="text-md font-serif font-black text-slate-800 flex items-center gap-1.5 justify-end">
                          <span>الغنائم المكتشفة من بستانك</span>
                          <span>🏆</span>
                        </h4>
                        <p className="text-slate-400 text-xs">احصد غنائم المعرفة عن طريق ري شجرتك وإتمام التحديات</p>
                      </div>

                      <div className="space-y-4">
                        {quotesUnlocked > 0 ? (
                          selectedBook.quotes.slice(0, quotesUnlocked).map((quote, idx) => (
                            <div 
                              key={idx}
                              className="bg-amber-50/50 border border-amber-200/40 rounded-2xl p-4 md:p-5 relative overflow-hidden"
                            >
                              <div className="absolute top-0 left-0 text-7xl font-black text-amber-100/30 font-serif select-none -translate-x-3 -translate-y-3">
                                ❝
                              </div>
                              <p className="text-xs md:text-sm font-serif font-bold leading-relaxed text-amber-950 relative z-10">
                                "{quote}"
                              </p>
                              <span className="inline-block text-[10px] text-amber-700 mt-2 font-serif">
                                🌾 غنيمة وحكمة بستانية رقم {idx + 1}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-12 space-y-3">
                            <span className="text-4xl text-slate-300">🔒</span>
                            <h5 className="font-serif font-bold text-slate-650 text-sm">الغنائم مقيدة بأقفال الصبر</h5>
                            <p className="text-slate-400 text-[11px] leading-relaxed max-w-[240px] mx-auto">
                              قم بتسجيل تأملاتك الأولى لتذويب كبرياء النفس أو أكمل تحدياتك الصباحية لترحيل السلبيات وسيدأ الحكيم في تزويدك بالحِكم تباعاً.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Book User Journal logs (6 cols) */}
                    <div className="lg:col-span-6 bg-[#fbfbf9] rounded-2xl border border-emerald-100/40 p-6 space-y-6 text-right shadow-inner">
                      <div className="border-b border-emerald-100/50 pb-3">
                        <h4 className="text-md font-serif font-black text-slate-800 flex items-center gap-1.5 justify-end">
                          <span>دفتر تفكراتك بقرص الشجرة</span>
                          <span>📔</span>
                        </h4>
                        <p className="text-slate-400 text-xs">سجل تاريخي دائم لكل ما قمت بمشاركته من صدق الذات</p>
                      </div>

                      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1.5 custom-scrollbar">
                        {(reflections[selectedBook.id] || []).length > 0 ? (
                          reflections[selectedBook.id].map((log, idx) => (
                            <div key={idx} className="bg-white border border-slate-100 p-4 rounded-xl space-y-2">
                              <div className="flex justify-between items-center text-[10px] text-slate-400">
                                <span>{log.date}</span>
                                <span className="font-bold text-emerald-850">ورقة: {log.leafName}</span>
                              </div>
                              <p className="text-xs text-slate-700 font-serif leading-relaxed font-bold">
                                {log.text}
                              </p>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-12 text-slate-400 text-xs font-serif">
                            بياض الأوراق يدعو فكرك للنقش؛ تفضل بقضاء بعض الوقت التفريغي في ثنايا الشجرة.
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                )}

              </div>

            </div>
          )
        )}

      </main>

      {/* 3. APP FOOTER */}
      <footer className="bg-white border-t border-emerald-100/40 mt-12 py-6 text-center text-xs text-slate-400 font-serif">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-3">
          <p>بستان المعرفة © {new Date().getFullYear()} مروي ببركة الأقدار وصدق الساعين</p>
          <div className="flex gap-4">
            <span>"بستانك يزكو بنقاء صدقك الداخلي"</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
