import React, { useState } from 'react';
import { ConsciousnessLevel } from '../types';

const CONSCIOUSNESS_LEVELS: ConsciousnessLevel[] = [
  { level: 1000, name: 'التنوير (كامل الوعي)', emotion: 'لا يمكن وصفه', viewOfLife: 'الكل متصل بالكل', color: 'bg-violet-950 text-violet-100 border-violet-800', description: 'قمة وعي الكائن البشري، حيث يتلاشى الفارق بين الذات والمقسوم، ويفيض في الروح فيض كوني مبارك دائم السكينة.' },
  { level: 600, name: 'السلام والسكينة', emotion: 'الإشراق والبهجة الصافية', viewOfLife: 'الوجود كامل ميسر', color: 'bg-indigo-900 text-indigo-100 border-indigo-750', description: 'سكون الروح الشفّاف، يرى الساعي الحياة كجريان خفيف ميسّر للماء الصافي؛ لا عتب، لا نكد، لا صراع.' },
  { level: 540, name: 'الفرح والغبطة', emotion: 'التسامح والسكوت السعيد', viewOfLife: 'العالم بهيج مبارك', color: 'bg-sky-850 text-white border-sky-700', description: 'شعور بالامتنان المتصل لغذاء البستان وأمن الحياة، محبة تطوق الأكوان عفوية ودون شروط مطلقة.' },
  { level: 500, name: 'المحبة والود', emotion: 'التبجيل والمودة الدائمة', viewOfLife: 'الحياة فسيحة غنية', color: 'bg-emerald-800 text-emerald-50 border-emerald-900', description: 'المحبة الفطرية النابعة من القلب لا العقل؛ تجعل المرء يبذل العون لشتلة جاره من غير انتظار للشكر.' },
  { level: 400, name: 'العقل والحكمة', emotion: 'الفهم المتزن والعلم', viewOfLife: 'الوضوح والتدقيق الحاد', color: 'bg-cyan-750 text-cyan-50 border-cyan-800', description: 'القدرة على فرز الغث من السمين بعين البستاني النقية المتأملة لتبدل الفصول وتبصر عواقب المزروعات.' },
  { level: 350, name: 'القبول والتسليم', emotion: 'الغفران والترحاب الرقيق', viewOfLife: 'منسجم ومقدّر', color: 'bg-teal-700 text-teal-50 border-teal-900', description: 'الكف الأبدي عن شجار الواقع، تقبل الطقس رطباً كان أو مصفّراً، وبدء تحضير التربة للزراعة بسلام واثق.' },
  { level: 310, name: 'الاستعداد والنهوض', emotion: 'التفاؤل والعزم الفتي', viewOfLife: 'العالم ممتلئ بالفرص', color: 'bg-emerald-600 text-emerald-50 border-emerald-750', description: 'النهوض في الفجر بهمة، الاستعداد لقضاء ساعات الخدمة في البستان بود ورضا تام، والحرص على التعلم.' },
  { level: 250, name: 'الحياد والبساطة', emotion: 'الثقة بالنفس وخلو البال', viewOfLife: 'الحياة سالكة طيبة', color: 'bg-slate-700 text-slate-100 border-slate-600', description: 'طاقة هادئة لا تعرف الهستيريا أو التعصب؛ مرونة ناعمة تساير هبات العواصف دون انكسار الأغصان.' },
  { level: 200, name: 'الشجاعة والهمة', emotion: 'التمكين والقدرة على الفعل', viewOfLife: 'مجال متاح للتحدي', color: 'bg-amber-650 text-white border-amber-800', description: 'عتبة الصلاح والتحول الفعلي! الكف عن لوم الظروف والمباشرة في شق القنوات وزرع الشتائل واثق الخطوة.' },
  { level: 175, name: 'الكبرياء والزهو', emotion: 'طلب التقدير والمقارنة', viewOfLife: 'الاستعراض المتنبه', color: 'bg-yellow-600 text-yellow-950 border-yellow-700', description: 'الترفع المؤقت الذي يبحث عن علو على أقرانه في الحقل؛ تيار طاقة هش دائم التوجس من النقد أو الذبول.' },
  { level: 150, name: 'الغضب والغل', emotion: 'العدوانية العارمة والمطالبة', viewOfLife: 'العالم غابة من الخصوم', color: 'bg-red-700 text-red-50 border-red-900', description: 'اضطراب الفؤاد وحرارة السخط لعدم نيل الشهوات؛ شحنة نارية هائجة تدمر أوراق الألفة وتصنع الرماد.' },
  { level: 125, name: 'الرغبة والتعلق النهم', emotion: 'الجشع والتملك المرهق', viewOfLife: 'النقص اللامرئي المستمر', color: 'bg-orange-600 text-orange-50 border-orange-850', description: 'الجرى المستميت وراء سراب البهجة العابرة دون إشباع؛ السقوط المستمر في وهاد التعود والتبعية الكئيبة.' },
  { level: 100, name: 'الخوف والقلق', emotion: 'الهلع والتحفز المرعب', viewOfLife: 'مخاطر تتربص بنا', color: 'bg-orange-800 text-orange-100 border-orange-950', description: 'خيال أسود يسكن الصدر فيحبس تدفق الضحك العفوي؛ يبدو المرج كله مليئاً بالوحوش والرياح العاتية القاصفة.' },
  { level: 75, name: 'الحزن الكئيب والأسى', emotion: 'التحسر والبكاء الصامت', viewOfLife: 'الفقد الحتمي المطلق', color: 'bg-rose-900 text-rose-100 border-rose-950', description: 'تراجع الطاقة وسقوط أوراق العزم حزناً على غروس ذوت، مغللاً صاحبه بالدموع وقصص الندب الحزين.' },
  { level: 50, name: 'اللامبالاة والخمول', emotion: 'اليأس والنوم الطويل', viewOfLife: 'انعدام القيمة والعدم', color: 'bg-stone-800 text-stone-100 border-stone-900', description: 'خضوع تام للموت البطيء، عجز عن ري شتلة الروح، والتظاهر بأن الحياة لا تستحق أدنى جهد أو نهوض كفاحي.' },
  { level: 30, name: 'الذنب وتأنيب النفس', emotion: 'النكد واللوم المستمر للذات', viewOfLife: 'القصاص والانتقام الداخلي', color: 'bg-stone-900 text-stone-100 border-stone-950', description: 'مطر بارد من جلد الذات يعطل زكاة الفطرة؛ سجن داخلي من الأفكار التي تطالب دوماً بمعاقبة النفس.' },
  { level: 20, name: 'العار والحقارة الشديدة', emotion: 'الهوان والاختباء من الضياء', viewOfLife: 'الانخساف والطرد', color: 'bg-red-950 text-red-100 border-red-980', description: 'أدنى مستويات الوعي البدني، رغبة كاسحة بالاختفاء تحت التراب والظهور بالانعدام خوفاً من ملامسة النور.' }
];

export default function ConsciousnessMap() {
  const [selectedIndex, setSelectedIndex] = useState<number>(8); // Defaults to Courage (level 200)

  const activeLevel = CONSCIOUSNESS_LEVELS[selectedIndex];

  // Helper to determine arrow and dynamic wisdom
  const isPositive = activeLevel.level >= 200;

  return (
    <div className="w-full bg-white rounded-3xl border border-emerald-100/50 p-6 md:p-8 shadow-xs">
      <div className="text-center mb-8">
        <span className="inline-flex bg-emerald-50 text-emerald-800 text-xs px-3 py-1 rounded-full font-serif font-bold mb-2">
          مستوحاة من أبحاث د. ديفيد هاوكينز
        </span>
        <h3 className="text-2xl font-serif text-slate-800 font-bold mb-2">
          مقياس مستويات وعي الكائن البشري التفاعلي
        </h3>
        <p className="text-slate-500 text-sm max-w-xl mx-auto">
          الوعي بستان متكامل يا رفيقي؛ حرك المقبض لترى الفرق بين مواطن القحط ومروج السلام المباركة، وتأمل أين تقع شتلة روحك اليوم.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Slider & Color Scale Panel (7 cols on desktop) */}
        <div className="lg:col-span-7 space-y-5 bg-[#fafafa] rounded-2xl p-5 border border-slate-100/60 shadow-inner">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs text-slate-500 font-bold px-1">
              <span>قمة وعي الكائن (1000)</span>
              <span>عتبة الشجاعة الفاصِلة (200)</span>
              <span>منبع القحط (20)</span>
            </div>
            
            <input 
              type="range" 
              min={0} 
              max={CONSCIOUSNESS_LEVELS.length - 1} 
              value={selectedIndex} 
              onChange={(e) => setSelectedIndex(Number(e.target.value))}
              className="w-full h-3 bg-gradient-to-l from-violet-900 via-emerald-600 via-amber-500 to-red-900 rounded-lg appearance-none cursor-pointer focus:outline-none"
              style={{ direction: 'rtl' }} // Ensures standard slider matches RTL Arabic order
            />
          </div>

          {/* Quick list showing the highlighted selected scale */}
          <div className="space-y-2 h-[340px] overflow-y-auto pr-2 custom-scrollbar">
            {CONSCIOUSNESS_LEVELS.map((col, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={col.level}
                  onClick={() => setSelectedIndex(idx)}
                  className={`w-full text-right flex items-center justify-between p-3 rounded-xl border text-sm transition-all duration-200 ${
                    isSelected 
                      ? `${col.color} scale-[1.01] shadow-md ring-2 ring-emerald-200` 
                      : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {col.level >= 200 ? (
                      <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-sm font-bold">بستان وارف</span>
                    ) : (
                      <span className="text-[11px] bg-red-50 text-red-700 px-2 py-0.5 rounded-sm font-bold">تحتاج رعاية</span>
                    )}
                    <span className="font-mono font-bold text-xs">{col.level}</span>
                  </div>
                  <span className="font-serif font-bold text-xs md:text-sm">{col.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Level Analysis Panel (5 cols on desktop) */}
        <div className="lg:col-span-5 bg-[#fbfbf9] rounded-2xl border border-emerald-100/40 p-6 md:p-8 space-y-6 shadow-xs">
          
          <div className="flex justify-between items-center">
            <span className="font-serif text-xs text-slate-500">مستوى الطاقة الحالي</span>
            <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
              <span className="font-mono text-xl font-black text-emerald-950">{activeLevel.level}</span>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xl font-serif font-black text-emerald-950 border-b border-emerald-100/50 pb-2">
              {activeLevel.name}
            </h4>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-white rounded-lg p-2.5 border border-slate-100">
                <p className="text-slate-400 mb-1">الشعور المهيمن</p>
                <p className="font-serif font-bold text-slate-700">{activeLevel.emotion}</p>
              </div>
              <div className="bg-white rounded-lg p-2.5 border border-slate-100">
                <p className="text-slate-400 mb-1">النظرة للحياة</p>
                <p className="font-serif font-bold text-slate-700">{activeLevel.viewOfLife}</p>
              </div>
            </div>
          </div>

          <div className="space-y-2 bg-white/70 backdrop-blur-xs p-4 rounded-xl border border-slate-100">
            <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1">
              <span>🌾</span>
              <span>تأثير هذا الوعي على بستانك</span>
            </h5>
            <p className="text-slate-600 text-xs leading-relaxed">
              {activeLevel.description}
            </p>
          </div>

          <div className="bg-emerald-50/50 border border-emerald-100/60 p-4 rounded-xl space-y-2">
            <h5 className="text-[11px] font-bold text-emerald-900 flex items-center gap-1 font-serif">
              <span>💡</span>
              <span>نصيحة الحكيم لطائفة الارتفاع</span>
            </h5>
            <p className="text-[11.5px] text-emerald-950 font-serif leading-relaxed">
              {isPositive 
                ? 'حافظ على سقيا هذه الشتلة الطيبة يا بني؛ تخل عن الكبرياء بمحبة حقيقية وانعم ببهجة التسليم الشافي لتصل للسكوت الرحيب.' 
                : 'إن بذور السلبية تحتاج لقرار حكيم منك؛ توقف عن تبرير الضيق ومحاربته بصرير الأفكار، خذ نفساً عميقاً وراقب موضع انقباض جسدك لتبدأ في الصعود نحو عتبة الشجاعة الفاصِلة.'}
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}
