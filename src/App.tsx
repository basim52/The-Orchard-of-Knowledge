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
import { BookData, LeafDetail, UserLibrary, LibraryInProgressBook } from './types';
import { BACKUP_BOOKS } from './defaultBooks';
import BookTree from './components/BookTree';
import ConsciousnessMap from './components/ConsciousnessMap';

// Import Firebase config & operational helpers
import { 
  auth, 
  googleProvider, 
  db, 
  handleFirestoreError, 
  OperationType 
} from './firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  getDocs,
  setDoc,
  collection,
  serverTimestamp
} from 'firebase/firestore';

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

  // Personal Library state (My Library 📚)
  const [libraryState, setLibraryState] = useState<UserLibrary>({
    finished: [],
    toRead: [],
    inProgress: []
  });
  const [showLibrary, setShowLibrary] = useState(false);
  const [libActiveTab, setLibActiveTab] = useState<'finished' | 'toRead' | 'inProgress'>('inProgress');
  const [editingBookIdInLib, setEditingBookIdInLib] = useState<string | null>(null);
  const [editingProgressVal, setEditingProgressVal] = useState('');

  // Inline progress update state inside active book tree view
  const [showInlineProgressInput, setShowInlineProgressInput] = useState(false);
  const [inlineEditingBookId, setInlineEditingBookId] = useState<string | null>(null);
  const [inlineProgressText, setInlineProgressText] = useState('');

  // Move book in library helper
  const moveBookToStatus = (bookId: string, status: 'toRead' | 'inProgress' | 'finished', currentProgressVal?: string) => {
    setLibraryState(prev => {
      // Filter out from all categories first to maintain strict mutual exclusivity
      const cleanToRead = prev.toRead.filter(id => id !== bookId);
      const cleanFinished = prev.finished.filter(id => id !== bookId);
      const cleanInProgress = prev.inProgress.filter(item => item.bookId !== bookId);

      if (status === 'toRead') {
        cleanToRead.push(bookId);
      } else if (status === 'finished') {
        cleanFinished.push(bookId);
      } else if (status === 'inProgress') {
        const existingInProgress = prev.inProgress.find(item => item.bookId === bookId);
        const progressText = currentProgressVal !== undefined ? currentProgressVal : (existingInProgress?.progress || 'البداية');
        cleanInProgress.push({
          bookId,
          progress: progressText,
          lastOpened: new Date().toISOString().split('T')[0]
        });
      }

      const updated = {
        finished: cleanFinished,
        toRead: cleanToRead,
        inProgress: cleanInProgress
      };

      localStorage.setItem('userLibrary', JSON.stringify(updated));
      return updated;
    });
  };

  // Firebase Auth & loading States
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState('');

  // Helper to sync user progress state to Firestore
  const syncUserProgressToFirestore = async (
    uid: string,
    challenges: Record<string, string[]>,
    userReflections: Record<string, { leafName: string, text: string, date: string }[]>,
    unlocked: Record<string, number>
  ) => {
    try {
      const pPath = `users/${uid}/progress/data`;
      await setDoc(doc(db, pPath), {
        userId: uid,
        completedChallenges: challenges,
        reflections: userReflections,
        unlockedLevel: unlocked,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `users/${uid}/progress/data`);
    }
  };

  // Listen to Authentication sessions and dynamically fetch cloud progress
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsLoadingAuth(false);
      
      if (currentUser) {
        // Safe timeout helpers to prevent slow connections from freezing the App
        const getDocWithTimeout = (ref: any): Promise<any> => {
          return Promise.race([
            getDoc(ref),
            new Promise<any>((_, reject) => 
              setTimeout(() => reject(new Error('Firestore getDoc timeout')), 2500)
            )
          ]);
        };

        const getDocsWithTimeout = (ref: any): Promise<any> => {
          return Promise.race([
            getDocs(ref),
            new Promise<any>((_, reject) => 
              setTimeout(() => reject(new Error('Firestore getDocs timeout')), 2500)
            )
          ]);
        };

        try {
          const pPath = `users/${currentUser.uid}/progress/data`;
          const pDoc = await getDocWithTimeout(doc(db, pPath));
          
          let challenges = completedChallenges;
          let userReflections = reflections;
          let unlocked = unlockedLevel;
          
          if (pDoc.exists()) {
            const remoteData = pDoc.data();
            challenges = remoteData.completedChallenges || {};
            userReflections = remoteData.reflections || {};
            unlocked = remoteData.unlockedLevel || {};
            
            setCompletedChallenges(challenges);
            setReflections(userReflections);
            setUnlockedLevel(unlocked);
            
            // Mirror to localStorage to keep offline backups ready
            localStorage.setItem('garden_challenges', JSON.stringify(challenges));
            localStorage.setItem('garden_reflections', JSON.stringify(userReflections));
            localStorage.setItem('garden_unlocked_quotes', JSON.stringify(unlocked));
          } else {
            // First time logging in. Promote existing local progress to cloud
            const savedChallenges = localStorage.getItem('garden_challenges');
            const savedReflections = localStorage.getItem('garden_reflections');
            const savedUnlocked = localStorage.getItem('garden_unlocked_quotes');
            
            const localCh = savedChallenges ? JSON.parse(savedChallenges) : {};
            const localRef = savedReflections ? JSON.parse(savedReflections) : {};
            const localUnl = savedUnlocked ? JSON.parse(savedUnlocked) : {};
            
            await setDoc(doc(db, pPath), {
              userId: currentUser.uid,
              completedChallenges: localCh,
              reflections: localRef,
              unlockedLevel: localUnl,
              updatedAt: serverTimestamp()
            });
          }
          
          // Also fetch custom books planted by this user
          const cbCollection = collection(db, `users/${currentUser.uid}/customBooks`);
          const cbSnap = await getDocsWithTimeout(cbCollection);
          const remoteCustomBooks: BookData[] = [];
          cbSnap.forEach((docSnapshot) => {
            remoteCustomBooks.push(docSnapshot.data() as BookData);
          });
          
          setBooks(prevBooks => {
            const staticBooks = prevBooks.filter(b => !b.id.startsWith('custom-'));
            return [...remoteCustomBooks, ...staticBooks];
          });
          
        } catch (err) {
          console.warn("Backend unavailable or connection timed out. Falling back to local offline storage.", err);
          
          // Safely load fallback storage data directly to maintain seamless usability
          const savedChallenges = localStorage.getItem('garden_challenges');
          const savedReflections = localStorage.getItem('garden_reflections');
          const savedUnlocked = localStorage.getItem('garden_unlocked_quotes');

          if (savedChallenges) setCompletedChallenges(JSON.parse(savedChallenges));
          if (savedReflections) setReflections(JSON.parse(savedReflections));
          if (savedUnlocked) setUnlockedLevel(JSON.parse(savedUnlocked));
        }
      } else {
        // Fallback to offline localStorage on sign out
        const savedChallenges = localStorage.getItem('garden_challenges');
        const savedReflections = localStorage.getItem('garden_reflections');
        const savedUnlocked = localStorage.getItem('garden_unlocked_quotes');

        if (savedChallenges) setCompletedChallenges(JSON.parse(savedChallenges));
        if (savedReflections) setReflections(JSON.parse(savedReflections));
        if (savedUnlocked) setUnlockedLevel(JSON.parse(savedUnlocked));
        
        // Remove customized books from state on sign out
        setBooks(prevBooks => prevBooks.filter(b => !b.id.startsWith('custom-')));
      }
    });

    return () => unsubscribe();
  }, [auth]);

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

  // Synchronize state with URL routing & browser history (Requirement 5)
  useEffect(() => {
    const handlePopState = () => {
      if (books.length === 0) return;
      const pathParts = window.location.pathname.split('/').filter(Boolean);
      if (pathParts.length === 2) {
        const [category, bookId] = pathParts;
        const foundBook = books.find(b => b.id === bookId);
        if (foundBook) {
          setSelectedCategory(category);
          setSelectedBook(foundBook);
          setView('tree');
          setActiveTab('tree');
          setSelectedLeaf(null);
        }
      } else if (pathParts.length === 1) {
        const [category] = pathParts;
        const validCategories = ["self-development", "psychology", "children", "sociology", "all"];
        if (validCategories.includes(category)) {
          setSelectedCategory(category);
          setSelectedBook(null);
          setView('home');
        }
      } else {
        setSelectedBook(null);
        setView('home');
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    // Initial sync once books are loaded
    if (books.length > 0) {
      handlePopState();
    }

    return () => window.removeEventListener('popstate', handlePopState);
  }, [books]);

  // Push state to url on navigation changes (Requirement 5)
  useEffect(() => {
    if (books.length === 0) return;
    if (view === 'tree' && selectedBook) {
      const cat = selectedBook.category || selectedCategory || 'self-development';
      const targetPath = `/${cat}/${selectedBook.id}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState(null, '', targetPath);
      }
    } else {
      const catPath = !selectedCategory || selectedCategory === 'all' ? '/' : `/${selectedCategory}`;
      if (window.location.pathname !== catPath) {
        window.history.pushState(null, '', catPath);
      }
    }
  }, [view, selectedBook, selectedCategory, books]);

  // Pre-load from local storage
  useEffect(() => {
    const savedChallenges = localStorage.getItem('garden_challenges');
    const savedReflections = localStorage.getItem('garden_reflections');
    const savedUnlocked = localStorage.getItem('garden_unlocked_quotes');
    const savedLibrary = localStorage.getItem('userLibrary');

    if (savedChallenges) setCompletedChallenges(JSON.parse(savedChallenges));
    if (savedReflections) setReflections(JSON.parse(savedReflections));
    if (savedUnlocked) setUnlockedLevel(JSON.parse(savedUnlocked));
    if (savedLibrary) {
      try {
        const parsed = JSON.parse(savedLibrary);
        setLibraryState({
          finished: Array.isArray(parsed.finished) ? parsed.finished : [],
          toRead: Array.isArray(parsed.toRead) ? parsed.toRead : [],
          inProgress: Array.isArray(parsed.inProgress) ? parsed.inProgress : []
        });
      } catch (e) {
        console.error("Failed to parse userLibrary", e);
      }
    }
  }, []);

  // Sync helpers with cloud awareness
  const saveChallenges = async (updated: Record<string, string[]>) => {
    setCompletedChallenges(updated);
    localStorage.setItem('garden_challenges', JSON.stringify(updated));
    if (user) {
      await syncUserProgressToFirestore(user.uid, updated, reflections, unlockedLevel);
    }
  };

  const saveReflections = async (updated: Record<string, { leafName: string, text: string, date: string }[]>) => {
    setReflections(updated);
    localStorage.setItem('garden_reflections', JSON.stringify(updated));
    if (user) {
      await syncUserProgressToFirestore(user.uid, completedChallenges, updated, unlockedLevel);
    }
  };

  const saveUnlocked = async (updated: Record<string, number>) => {
    setUnlockedLevel(updated);
    localStorage.setItem('garden_unlocked_quotes', JSON.stringify(updated));
    if (user) {
      await syncUserProgressToFirestore(user.uid, completedChallenges, reflections, updated);
    }
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
      if (user) {
        try {
          const bookPath = `users/${user.uid}/customBooks/${mappedBook.id}`;
          const bookToSave = {
            ...mappedBook,
            userId: user.uid,
            createdAt: serverTimestamp()
          };
          await setDoc(doc(db, bookPath), bookToSave);
        } catch (e) {
          handleFirestoreError(e, OperationType.CREATE, `users/${user.uid}/customBooks/${mappedBook.id}`);
        }
      }

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

  // Google Authentication trigger
  const handleSignIn = async () => {
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Popup block or network error inside iframe environment:", err);
      setAuthError('تعذر تسجيل الدخول باستخدام غوغل. يرجى المحاولة مرة أخرى.');
    }
  };

  // Sign out trigger
  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err: any) {
      console.error("Error signing out:", err);
    }
  };

  // Compute stats for current selected book
  const bookId = selectedBook?.id || '';
  const completedChCt = completedChallenges[bookId]?.length || 0;
  const reflectionsCt = reflections[bookId]?.length || 0;
  const quotesUnlocked = unlockedLevel[bookId] || 0;

  const isInLibInProgress = libraryState.inProgress.some(item => item.bookId === bookId);
  const currentLibInProgressBook = libraryState.inProgress.find(item => item.bookId === bookId);

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
              <div id="brand-logo-text" className="text-lg font-serif font-black text-emerald-950 flex items-center gap-1">
                بستان المعرفة
              </div>
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

            <button 
              onClick={() => {
                setShowLibrary(true);
                setLibActiveTab('inProgress');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-serif font-bold text-emerald-950 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors border border-amber-200/50 cursor-pointer shadow-xs whitespace-nowrap select-none"
            >
              <span>مكتبتي 📚</span>
            </button>
            
            {isLoadingAuth ? (
              <span className="text-xs text-slate-400 font-serif flex items-center gap-1 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-full">
                <RefreshCw className="w-3 h-3 animate-spin text-emerald-700" />
                <span>تحقق...</span>
              </span>
            ) : user ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs font-bold text-slate-800 font-serif max-w-[120px] truncate">
                    {user.displayName || user.email?.split('@')[0]}
                  </span>
                  <button 
                    onClick={handleSignOut}
                    className="text-[10px] text-red-600 hover:text-red-700 font-serif font-bold hover:underline transition-all cursor-pointer text-right inline-block self-end mt-0.5"
                  >
                    تسجيل الخروج
                  </button>
                </div>
                {user.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt={user.displayName || "User"} 
                    className="w-8 h-8 rounded-full border border-emerald-100 shadow-tiny object-cover shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-emerald-700 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {user.displayName ? user.displayName[0].toUpperCase() : '👤'}
                  </div>
                )}
                {/* Mobile logout link only */}
                <button 
                  onClick={handleSignOut}
                  className="sm:hidden text-xs bg-red-50 text-red-600 hover:bg-red-100 px-2 py-1.5 rounded-lg font-serif font-bold transition-colors cursor-pointer"
                >
                  خروج
                </button>
              </div>
            ) : (
              <button 
                onClick={handleSignIn}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-serif font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors border border-emerald-800 cursor-pointer shadow-xs active:scale-95 duration-100"
              >
                <span>👤</span>
                <span>دخول غوغل</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. CORE CONTENT AREA */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 md:px-8 pt-8 pb-28">
        
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

            {/* Firebase Auth Error Alert */}
            {authError && (
              <div className="bg-red-50 text-red-800 border-2 border-red-100 p-4 rounded-2xl text-xs md:text-sm font-serif flex items-center justify-between gap-4 shadow-sm animate-pulse">
                <span className="flex items-center gap-2">
                  <span>🚨</span>
                  <span>{authError}</span>
                </span>
                <button 
                  onClick={() => setAuthError('')}
                  className="bg-red-100 text-red-800 hover:bg-red-200 px-3 py-1 rounded-lg font-bold"
                >
                  إغلاق
                </button>
              </div>
            )}

            {/* Cloud Storage CTA Banner */}
            {!user && (
              <div className="bg-amber-50/45 border border-amber-200/40 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm transition-all duration-300">
                <div className="flex items-start gap-3.5 text-right w-full">
                  <span className="text-3xl mt-0.5 shrink-0 select-none">☁️</span>
                  <div className="space-y-1">
                    <h4 className="text-sm font-serif font-black text-amber-955 flex items-center gap-1">
                      <span>احفظ وسجّل بستانك في السحابة</span>
                    </h4>
                    <p className="text-amber-900/80 text-xs font-serif leading-relaxed">
                      "يا رفيقي الساعي، تقدمك في سقاية أشجارك المعرفية وكتابة تأملاتك ممتد وأصيل. سجّل دخولك بحساب غوغل لحفظ إنجازاتك وسقياك بشكل آمن، ومزامنتها تلقائياً لتطالع معبرك أينما ارتحلت."
                    </p>
                  </div>
                </div>
                <button 
                  onClick={handleSignIn}
                  className="bg-emerald-750 hover:bg-emerald-800 text-white bg-emerald-700 font-serif font-black text-xs px-5 py-3 rounded-2xl flex items-center gap-2 cursor-pointer max-w-full shrink-0 shadow-sm active:scale-95 duration-100 border border-emerald-900"
                >
                  <span>تسجيل الدخول الآن بحساب غوغل</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

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
                        
                        {/* Crawlable cover image with Alt text for SEO (Requirement 5) */}
                        <img 
                          src={`/assets/dynamic-covers/${book.id}.jpg`} 
                          alt={`غلاف كتاب ${book.title}`} 
                          className="sr-only" 
                          referrerPolicy="no-referrer"
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        />

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
            <div className="space-y-6">
              
              {/* Dynamic Breadcrumbs (Requirement 7) */}
              <div id="book-breadcrumbs" className="flex items-center gap-1.5 text-xs text-slate-500 font-serif pb-1 justify-start">
                <button onClick={handleBackToGarden} className="hover:text-emerald-800 transition cursor-pointer">بستان المعرفة</button>
                <ChevronLeft className="w-3 h-3 text-slate-400 select-none" />
                <button 
                  onClick={() => { 
                    setSelectedCategory(selectedBook.category || 'self-development'); 
                    handleBackToGarden(); 
                  }} 
                  className="hover:text-emerald-800 transition cursor-pointer"
                >
                  {selectedBook.category === 'self-development' ? 'تطوير الذات' :
                   selectedBook.category === 'psychology' ? 'علم النفس' :
                   selectedBook.category === 'children' ? 'كتب الأطفال' :
                   selectedBook.category === 'sociology' ? 'علم الاجتماع' : 'تطوير الذات'}
                </button>
                <ChevronLeft className="w-3 h-3 text-slate-400 select-none" />
                <span className="font-bold text-slate-700">{selectedBook.title}</span>
              </div>

              {/* Poetic Book Header Banner */}
              <div className="flex flex-col bg-white rounded-3xl border border-emerald-100/50 p-6 md:p-8 gap-4 shadow-xs">
                
                {/* Dynamically Crawlable Cover Image with Alt Text (Requirement 5 & Guidelines) */}
                <img 
                  src={`/assets/dynamic-covers/${selectedBook.id}.jpg`} 
                  alt={`غلاف شجرة كتاب ${selectedBook.title}`} 
                  className="sr-only" 
                  referrerPolicy="no-referrer"
                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                />

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 w-full">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-emerald-800 font-serif font-black">
                      <span>بستان الكتاب</span>
                      <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full"></span>
                      <span>{selectedBook.author}</span>
                    </div>
                    <h1 className="text-2xl md:text-3xl font-serif font-black text-emerald-950 flex items-center gap-2">
                      <span>شجرة:</span>
                      <span>{selectedBook.title}</span>
                    </h1>
                  </div>

                  <div className="flex items-center gap-2 bg-emerald-50/50 border border-emerald-150 px-4 py-2 rounded-2xl text-xs text-emerald-990 font-serif shrink-0">
                    <span className="font-bold">معدل سقياك:</span>
                    <span>{reflectionsCt} تأمل محرز</span>
                    <span className="opacity-40">|</span>
                    <span>{completedChCt}/7 أيام تحدي</span>
                  </div>
                </div>

                {/* Library controls section */}
                <div className="flex flex-wrap gap-2 mt-2 pt-4 border-t border-slate-100 w-full justify-start items-center">
                  <span className="text-xs font-serif font-black text-[#5c6861] ml-2">نظام القراءة 📚:</span>

                  {/* 1. Add to / status of: ssaqra7ha */}
                  <button
                    onClick={() => moveBookToStatus(selectedBook.id, 'toRead')}
                    className={`px-3 py-1.5 text-xs font-serif font-bold rounded-xl border transition-all duration-200 flex items-center gap-1 cursor-pointer select-none active:scale-95 duration-100 ${
                      libraryState.toRead.includes(selectedBook.id)
                        ? 'bg-amber-100/70 text-amber-900 border-amber-300 shadow-tiny'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-amber-50/50 hover:text-amber-800'
                    }`}
                  >
                    <span>📌</span>
                    <span>{libraryState.toRead.includes(selectedBook.id) ? 'في قائمة سأقرأها' : 'أضف إلى سأقرأها'}</span>
                  </button>

                  {/* 2. Start / update progress: in progress */}
                  {isInLibInProgress ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => {
                          setInlineEditingBookId(selectedBook.id);
                          setInlineProgressText(currentLibInProgressBook?.progress || '');
                          setShowInlineProgressInput(true);
                        }}
                        className="px-3 py-1.5 text-xs font-serif font-bold rounded-xl border bg-blue-50 text-blue-900 border-blue-250 hover:bg-dashblue-100 transition-all cursor-pointer flex items-center gap-1 select-none active:scale-95"
                      >
                        <span>📖</span>
                        <span>حدّث التقدم</span>
                      </button>

                      {currentLibInProgressBook?.progress && (
                        <span className="text-xs font-serif font-bold text-blue-800 bg-blue-50/50 px-2.5 py-1 rounded-xl border border-blue-100 max-w-[200px] truncate" title={currentLibInProgressBook.progress}>
                          التقدم: {currentLibInProgressBook.progress}
                        </span>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        moveBookToStatus(selectedBook.id, 'inProgress');
                        setInlineEditingBookId(selectedBook.id);
                        setInlineProgressText('');
                        setShowInlineProgressInput(true);
                      }}
                      className="px-3 py-1.5 text-xs font-serif font-bold rounded-xl border bg-white text-slate-600 border-slate-200 hover:bg-blue-50/50 hover:text-blue-800 transition-all cursor-pointer flex items-center gap-1 select-none active:scale-95"
                    >
                      <span>📖</span>
                      <span>ابدأ القراءة</span>
                    </button>
                  )}

                  {/* 3. Completed: finished */}
                  <button
                    onClick={() => moveBookToStatus(selectedBook.id, 'finished')}
                    className={`px-3 py-1.5 text-xs font-serif font-bold rounded-xl border transition-all duration-200 flex items-center gap-1 cursor-pointer select-none active:scale-95 duration-100 ${
                      libraryState.finished.includes(selectedBook.id)
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-tiny'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-emerald-50 hover:text-emerald-800'
                    }`}
                  >
                    <span>✔️</span>
                    <span>{libraryState.finished.includes(selectedBook.id) ? 'تم إنهاء الكتاب 🎉' : 'أنهيت الكتاب'}</span>
                  </button>
                </div>

                {/* Inline Editing Progress Form */}
                {showInlineProgressInput && inlineEditingBookId === selectedBook.id && (
                  <div className="mt-2 bg-blue-50/30 p-4 rounded-2xl border border-blue-100 flex flex-col sm:flex-row items-center gap-3 w-full animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="flex-grow w-full text-right">
                      <label className="text-[10px] font-bold text-blue-700/80 uppercase block mb-1">تسجيل تقدم قراءتك الحالي (الصفحة، الفصل، الفرع، أو النقطة):</label>
                      <input
                        type="text"
                        value={inlineProgressText}
                        onChange={(e) => setInlineProgressText(e.target.value)}
                        placeholder="مثال: الفصل الثاني - الورقة الثالثة"
                        className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            moveBookToStatus(selectedBook.id, 'inProgress', inlineProgressText);
                            setShowInlineProgressInput(false);
                          }
                        }}
                      />
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto self-end">
                      <button
                        onClick={() => {
                          moveBookToStatus(selectedBook.id, 'inProgress', inlineProgressText);
                          setShowInlineProgressInput(false);
                        }}
                        className="flex-1 sm:flex-none px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-serif font-bold transition-colors cursor-pointer whitespace-nowrap"
                      >
                        حفظ التقدم
                      </button>
                      <button
                        onClick={() => setShowInlineProgressInput(false)}
                        className="flex-1 sm:flex-none px-4 py-2 bg-white border border-slate-200 text-slate-500 rounded-xl text-xs font-serif font-bold hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                )}
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

                      {/* فهرس الأغصان والأوراق المكتوب (Outline for SEO & Accessibility - Requirement 4) */}
                      <div className="bg-white rounded-3xl border border-emerald-100/50 p-6 md:p-8 mt-4 text-right space-y-6">
                        <div className="border-b border-emerald-100/30 pb-3 flex items-center justify-between">
                          <span className="text-xs text-slate-400 font-sans font-medium">فهرس شجري متكامل</span>
                          <h2 className="text-lg font-serif font-black text-slate-800">
                            أغصان وأوراق كتاب: {selectedBook.title}
                          </h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {selectedBook.branches.map((branch, bIdx) => (
                            <div key={bIdx} className="space-y-3 bg-[#fbfbf9] p-4 rounded-2xl border border-slate-100 flex flex-col justify-between">
                              <div className="space-y-1.5">
                                <h2 className="text-md font-serif font-black text-emerald-900 flex items-center gap-1.5 justify-end">
                                  <span>{branch.name}</span>
                                  <span className="text-emerald-600">🌿</span>
                                </h2>
                                <p className="text-xs text-[#5c6861] leading-relaxed font-serif">
                                  {branch.description}
                                </p>
                              </div>
                              <div className="space-y-2 border-t border-slate-100/70 pt-2.5 mt-2.5">
                                {branch.leaves.map((leaf, lIdx) => (
                                  <button 
                                    key={lIdx} 
                                    onClick={() => handleLeafClick(leaf, branch.name)}
                                    className={`w-full p-2.5 rounded-xl border text-right transition-all cursor-pointer flex justify-between items-center ${
                                      selectedLeaf?.name === leaf.name 
                                        ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold' 
                                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                                    }`}
                                  >
                                    <span className="text-[10px] font-serif text-slate-400">انقر للتأمل</span>
                                    <h3 className="text-xs md:text-sm font-serif font-bold flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                                      {leaf.name}
                                    </h3>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
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
                            <h3 className="text-xl md:text-2xl font-serif font-black text-emerald-950">
                              {selectedLeaf.name}
                            </h3>

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
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-[#fcfbf7]/80 backdrop-blur-md border-t border-emerald-100/25 py-2.5 shadow-[0_-2px_12px_rgba(0,0,0,0.02)]">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="text-[11px] font-serif text-slate-500/90 leading-relaxed">
            <p className="font-bold text-emerald-850">فكرة وبرمجة</p>
            <p className="mt-0.5 text-slate-700">باسم آل خليل</p>
            <p className="mt-0.5 text-slate-500 font-sans">basim5252@gmail.com</p>
            <p className="mt-0.5 text-slate-400">بمساعدة AI Gemini و AI DeepSeek</p>
          </div>
        </div>
      </footer>

      {/* PERSONAL LIBRARY OVERLAY MODAL */}
      {showLibrary && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4" id="library-modal-overlay">
          <div className="bg-[#fcfbf7] border border-emerald-100 w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="p-5 border-b border-emerald-100 flex items-center justify-between text-right">
              <div className="flex items-center gap-2">
                <span className="text-xl">📚</span>
                <h3 className="text-lg font-serif font-black text-emerald-950">مكتبتي الشخصية</h3>
              </div>
              <button
                onClick={() => setShowLibrary(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer select-none"
              >
                ✕
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-100 pb-0.5 px-4 bg-slate-50/50">
              {[
                { id: 'inProgress', label: 'قيد القراءة', icon: '📖' },
                { id: 'toRead', label: 'سأقرأها', icon: '📌' },
                { id: 'finished', label: 'تمت قراءتها', icon: '✔️' }
              ].map((tab) => {
                let count = 0;
                if (tab.id === 'inProgress') count = libraryState.inProgress.length;
                else if (tab.id === 'toRead') count = libraryState.toRead.length;
                else if (tab.id === 'finished') count = libraryState.finished.length;

                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setLibActiveTab(tab.id as any);
                      setEditingBookIdInLib(null);
                    }}
                    className={`flex-1 py-3 text-center text-xs md:text-sm font-serif font-bold border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 select-none ${
                      libActiveTab === tab.id
                        ? 'border-emerald-700 text-emerald-900 font-black'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                    <span className="bg-slate-200/60 text-slate-755 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold leading-none">{count}</span>
                  </button>
                );
              })}
            </div>

            {/* List Body */}
            <div className="p-6 overflow-y-auto flex-grow space-y-4">
              
              {libActiveTab === 'inProgress' && (
                <div className="space-y-4">
                  {libraryState.inProgress.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 font-serif text-sm">
                      <p className="text-3xl mb-2">📖</p>
                      <p>لا توجد كتب قيد القراءة حالياً.</p>
                      <p className="text-xs text-slate-400 mt-1">اختر كتاباً من الرف وابدأ في المرافقة والسقاية.</p>
                    </div>
                  ) : (
                    libraryState.inProgress.map((item) => {
                      const book = books.find(b => b.id === item.bookId);
                      if (!book) return null;
                      const isEditing = editingBookIdInLib === item.bookId;

                      return (
                        <div key={item.bookId} className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col gap-3">
                          <div className="flex gap-4 items-start text-right">
                            {/* Styled mini Cover */}
                            <div 
                              onClick={() => {
                                handleSelectBook(book);
                                setShowLibrary(false);
                              }}
                              className={`w-14 h-20 rounded-lg shadow-md border-r-4 relative overflow-hidden flex flex-col justify-between p-2 shrink-0 cursor-pointer ${book.cover}`}
                            >
                              <div className="absolute top-0 right-0 w-1 h-full bg-black/15"></div>
                              <span className="text-[8px] opacity-75">🪶</span>
                              <h5 className="text-[10px] font-serif font-black leading-tight select-none truncate-two-lines text-white">{book.title}</h5>
                              <span className="text-[8px] opacity-60 self-end">🌳</span>
                            </div>

                            {/* Info & Actions */}
                            <div className="flex-grow space-y-1">
                              <h4 className="font-serif font-black text-sm text-slate-800 cursor-pointer hover:text-emerald-800" onClick={() => { handleSelectBook(book); setShowLibrary(false); }}>
                                {book.title}
                              </h4>
                              <p className="text-xs text-slate-400 font-serif">{book.author}</p>
                              
                              <div className="text-xs text-slate-500 font-serif flex items-center gap-4 pt-1 flex-wrap">
                                <span>
                                  التقدم: <strong className="text-blue-800">{item.progress || 'لم يحدد'}</strong>
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  آخر فتح: {item.lastOpened || '-'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Inline Edit Form */}
                          {isEditing ? (
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center gap-2 animate-in fade-in duration-150">
                              <input
                                type="text"
                                value={editingProgressVal}
                                onChange={(e) => setEditingProgressVal(e.target.value)}
                                placeholder="مثال: الصفحة 23 - الفصل الثاني"
                                className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 text-right"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    moveBookToStatus(item.bookId, 'inProgress', editingProgressVal);
                                    setEditingBookIdInLib(null);
                                  }
                                }}
                              />
                              <div className="flex gap-1.5 w-full sm:w-auto self-end">
                                <button
                                  onClick={() => {
                                    moveBookToStatus(item.bookId, 'inProgress', editingProgressVal);
                                    setEditingBookIdInLib(null);
                                  }}
                                  className="flex-1 sm:flex-none px-3 py-1.5 bg-blue-700 text-white rounded-lg text-xs font-serif font-bold hover:bg-blue-800 cursor-pointer whitespace-nowrap"
                                >
                                  حفظ
                                </button>
                                <button
                                  onClick={() => setEditingBookIdInLib(null)}
                                  className="flex-1 sm:flex-none px-3 py-1.5 bg-white border border-slate-200 text-slate-500 rounded-lg text-xs font-serif font-bold hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                                >
                                  إلغاء
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-50/80">
                              <button
                                onClick={() => {
                                  // Update lastOpened & load book
                                  moveBookToStatus(item.bookId, 'inProgress', item.progress);
                                  handleSelectBook(book);
                                  setShowLibrary(false);
                                }}
                                className="px-3 py-1.5 bg-emerald-50 text-emerald-850 border border-emerald-100/60 rounded-xl text-xs font-serif font-bold hover:bg-emerald-100 transition-colors cursor-pointer flex items-center gap-1 select-none"
                              >
                                <span>🚀</span>
                                <span>استئناف القراءة</span>
                              </button>
                              
                              <button
                                onClick={() => {
                                  setEditingBookIdInLib(item.bookId);
                                  setEditingProgressVal(item.progress || '');
                                }}
                                className="px-3 py-1.5 bg-slate-50 text-slate-600 border border-slate-200/50 rounded-xl text-xs font-serif font-bold hover:bg-slate-100 transition-colors cursor-pointer select-none"
                              >
                                ⚙️ تعديل التقدم
                              </button>

                              <button
                                onClick={() => moveBookToStatus(item.bookId, 'finished')}
                                className="px-3 py-1.5 bg-white text-slate-550 border border-slate-200 rounded-xl text-xs font-serif font-bold hover:bg-emerald-50 hover:text-emerald-800 transition-colors cursor-pointer mr-auto select-none"
                              >
                                ✔️ أنهيت الكتاب
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {libActiveTab === 'toRead' && (
                <div className="space-y-4">
                  {libraryState.toRead.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 font-serif text-sm">
                      <p className="text-3xl mb-2">📌</p>
                      <p>لا توجد كتب في قائمة سأقرأها.</p>
                      <p className="text-xs text-slate-400 mt-1">اضغط زر "أضف إلى سأقرأها" في صفحة أي كتاب ليرسو هنا.</p>
                    </div>
                  ) : (
                    libraryState.toRead.map((id) => {
                      const book = books.find(b => b.id === id);
                      if (!book) return null;

                      return (
                        <div key={id} className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div className="flex gap-4 items-center text-right">
                            {/* Styled mini Cover */}
                            <div 
                              onClick={() => {
                                handleSelectBook(book);
                                setShowLibrary(false);
                              }}
                              className={`w-12 h-16 rounded-lg shadow-md border-r-4 relative overflow-hidden flex flex-col justify-between p-1.5 shrink-0 cursor-pointer ${book.cover}`}
                            >
                              <div className="absolute top-0 right-0 w-0.5 h-full bg-black/15"></div>
                              <span className="text-[7px]">🪶</span>
                              <h5 className="text-[9px] font-serif font-black leading-tight select-none truncate-two-lines text-white">{book.title}</h5>
                              <span className="text-[7px] self-end">🌳</span>
                            </div>

                            <div className="space-y-0.5 text-right">
                              <h4 className="font-serif font-black text-sm text-slate-800 cursor-pointer hover:text-emerald-800" onClick={() => { handleSelectBook(book); setShowLibrary(false); }}>
                                {book.title}
                              </h4>
                              <p className="text-xs text-slate-400 font-serif">{book.author}</p>
                            </div>
                          </div>

                          <div className="flex gap-2 w-full sm:w-auto justify-end">
                            <button
                              onClick={() => moveBookToStatus(id, 'inProgress')}
                              className="px-3 py-1.5 bg-blue-50 text-blue-850 hover:bg-blue-100 border border-blue-100/60 rounded-xl text-xs font-serif font-bold transition-colors cursor-pointer flex items-center gap-1 select-none"
                            >
                              <span>📖</span>
                              <span>ابدأ القراءة</span>
                            </button>
                            <button
                              onClick={() => {
                                handleSelectBook(book);
                                setShowLibrary(false);
                              }}
                              className="px-3 py-1.5 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-serif font-bold transition-colors cursor-pointer select-none"
                            >
                              🔍 استكشف الشجرة
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {libActiveTab === 'finished' && (
                <div className="space-y-4">
                  {libraryState.finished.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 font-serif text-sm">
                      <p className="text-3xl mb-2">✔️</p>
                      <p>لا توجد كتب مقروءة بعد أو مكتملة.</p>
                      <p className="text-xs text-slate-400 mt-1">اضغط زر "أنهيت الكتاب" لترحيل الكتب المكتملة هنا بفخر.</p>
                    </div>
                  ) : (
                    libraryState.finished.map((id) => {
                      const book = books.find(b => b.id === id);
                      if (!book) return null;

                      return (
                        <div key={id} className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div className="flex gap-4 items-center text-right">
                            {/* Styled mini Cover */}
                            <div 
                              onClick={() => {
                                handleSelectBook(book);
                                setShowLibrary(false);
                              }}
                              className={`w-12 h-16 rounded-lg shadow-md border-r-4 relative overflow-hidden flex flex-col justify-between p-1.5 shrink-0 cursor-pointer ${book.cover}`}
                            >
                              <div className="absolute top-0 right-0 w-0.5 h-full bg-black/15"></div>
                              <span className="text-[7px]">🪶</span>
                              <h5 className="text-[9px] font-serif font-black leading-tight select-none truncate-two-lines text-white">{book.title}</h5>
                              <span className="text-[7px] self-end">🌳</span>
                            </div>

                            <div className="space-y-0.5 text-right">
                              <h4 className="font-serif font-black text-sm text-slate-800 cursor-pointer hover:text-emerald-800" onClick={() => { handleSelectBook(book); setShowLibrary(false); }}>
                                {book.title}
                              </h4>
                              <p className="text-xs text-slate-400 font-serif">{book.author}</p>
                            </div>
                          </div>

                          <div className="flex gap-2 w-full sm:w-auto justify-end items-center">
                            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-xl text-[10px] font-serif font-bold border border-emerald-100 flex items-center gap-1 shrink-0">
                              <span>🎉</span>
                              <span>تمت القراءة بنجاح</span>
                            </span>
                            <button
                              onClick={() => {
                                handleSelectBook(book);
                                setShowLibrary(false);
                              }}
                              className="px-3 py-1.5 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-serif font-bold transition-colors cursor-pointer select-none"
                            >
                              🔍 استكشف الشجرة
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

            </div>

            {/* Footer info label */}
            <div className="p-4 bg-slate-50/80 border-t border-emerald-100/40 text-[10px] font-serif text-slate-400 text-center">
              يتم حفظ التقدم تلقائياً وبأمان في بستان جهازك اليدوي والمستقل.
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
