import type { Locale } from './locale';

// English | Italian | Russian | Arabic | Hindi | Urdu
const entries = `
Language|Lingua|Язык|اللغة|भाषा|زبان
Appearance|Aspetto|Оформление|المظهر|दिखावट|ظاہری شکل
Color theme|Tema colori|Цветовая тема|سمة الألوان|रंग थीम|رنگوں کی تھیم
Dark|Scuro|Тёмная|داكن|गहरा|گہری
Light|Chiaro|Светлая|فاتح|हल्का|ہلکی
Settings|Impostazioni|Настройки|الإعدادات|सेटिंग्स|ترتیبات
Profile|Profilo|Профиль|الملف الشخصي|प्रोफ़ाइल|پروفائل
Your profile|Il tuo profilo|Ваш профиль|ملفك الشخصي|आपकी प्रोफ़ाइल|آپ کا پروفائل
Open profile|Apri il profilo|Открыть профиль|افتح الملف الشخصي|प्रोफ़ाइल खोलें|پروفائل کھولیں
← Profile|← Profilo|← Профиль|الملف الشخصي|प्रोफ़ाइल पर लौटें|پروفائل پر واپس جائیں
‹ Profile|‹ Profilo|‹ Профиль|الملف الشخصي|प्रोफ़ाइल पर लौटें|پروفائل پر واپس جائیں
← BottleForMe|← BottleForMe|← BottleForMe|العودة إلى BottleForMe|BottleForMe पर लौटें|BottleForMe پر واپس جائیں
Radar|Radar|Радар|الرادار|रडार|ریڈار
Pickups|Ritiri|Вывозы|عمليات الاستلام|पिकअप|پک اپ
Pickup details|Dettagli del ritiro|Детали вывоза|تفاصيل الاستلام|पिकअप का विवरण|پک اپ کی تفصیلات
Pickup chat|Chat del ritiro|Чат вывоза|محادثة الاستلام|पिकअप चैट|پک اپ چیٹ
Pickup messages|Messaggi del ritiro|Сообщения о вывозе|رسائل الاستلام|पिकअप के संदेश|پک اپ کے پیغامات
‹ Pickup details|‹ Dettagli del ritiro|‹ Детали вывоза|تفاصيل الاستلام|पिकअप विवरण पर लौटें|پک اپ کی تفصیلات پر واپس جائیں
← Pickup details|← Dettagli del ritiro|← Детали вывоза|تفاصيل الاستلام|पिकअप विवरण पर लौटें|پک اپ کی تفصیلات پر واپس جائیں
← All pickups|← Tutti i ritiri|← Все вывозы|كل عمليات الاستلام|सभी पिकअप|تمام پک اپ
Your pickups|I tuoi ritiri|Ваши вывозы|عمليات الاستلام الخاصة بك|आपके पिकअप|آپ کے پک اپ
Your pickups as Giver|I tuoi ritiri come donatore|Ваши вывозы как дарителя|عمليات الاستلام بصفتك معطيًا|देने वाले के रूप में आपके पिकअप|دینے والے کے طور پر آپ کے پک اپ
Your pickups as Taker|I tuoi ritiri come raccoglitore|Ваши вывозы как сборщика|عمليات الاستلام بصفتك جامعًا|इकट्ठा करने वाले के रूप में आपके पिकअप|جمع کرنے والے کے طور پر آپ کے پک اپ
List Empties|Pubblica i vuoti|Разместить тару|أضف العبوات الفارغة|खाली बोतलें सूचीबद्ध करें|خالی بوتلوں کا اشتہار دیں
Give|Dona|Отдать|قدّم العبوات|दें|دیں
Giver|Donatore|Даритель|المعطي|देने वाला|دینے والا
Taker|Raccoglitore|Сборщик|الجامع|इकट्ठा करने वाला|جمع کرنے والا
Log in|Accedi|Войти|تسجيل الدخول|लॉग इन करें|لاگ ان کریں
Register|Registrati|Зарегистрироваться|إنشاء حساب|रजिस्टर करें|رجسٹر کریں
Log out|Esci|Выйти|تسجيل الخروج|लॉग आउट करें|لاگ آؤٹ کریں
Sign in or register|Accedi o registrati|Войти или зарегистрироваться|سجّل الدخول أو أنشئ حسابًا|लॉग इन या रजिस्टर करें|لاگ ان یا رجسٹر کریں
Forgot password|Password dimenticata|Забыли пароль|نسيت كلمة المرور|पासवर्ड भूल गए|پاس ورڈ بھول گئے
Back to log in|Torna all’accesso|Назад ко входу|العودة إلى تسجيل الدخول|लॉग इन पर लौटें|لاگ ان پر واپس جائیں
Email address|Indirizzo email|Электронная почта|عنوان البريد الإلكتروني|ईमेल पता|ای میل پتہ
Password|Password|Пароль|كلمة المرور|पासवर्ड|پاس ورڈ
New password|Nuova password|Новый пароль|كلمة المرور الجديدة|नया पासवर्ड|نیا پاس ورڈ
Current password|Password attuale|Текущий пароль|كلمة المرور الحالية|मौजूदा पासवर्ड|موجودہ پاس ورڈ
Confirm new password|Conferma la nuova password|Подтвердите новый пароль|أكّد كلمة المرور الجديدة|नए पासवर्ड की पुष्टि करें|نئے پاس ورڈ کی تصدیق کریں
Choose a new password|Scegli una nuova password|Выберите новый пароль|اختر كلمة مرور جديدة|नया पासवर्ड चुनें|نیا پاس ورڈ منتخب کریں
Full name|Nome e cognome|Имя и фамилия|الاسم الكامل|पूरा नाम|پورا نام
Starting role|Ruolo iniziale|Начальная роль|الدور الأولي|शुरुआती भूमिका|ابتدائی کردار
Country calling code|Prefisso internazionale|Телефонный код страны|رمز الاتصال الدولي|देश का फ़ोन कोड|ملکی فون کوڈ
Phone (optional)|Telefono (facoltativo)|Телефон (необязательно)|رقم الهاتف (اختياري)|फ़ोन (वैकल्पिक)|فون (اختیاری)
Phone Number|Numero di telefono|Номер телефона|رقم الهاتف|फ़ोन नंबर|فون نمبر
Revolut tag (optional)|Tag Revolut (facoltativo)|Тег Revolut (необязательно)|معرّف Revolut (اختياري)|Revolut टैग (वैकल्पिक)|Revolut ٹیگ (اختیاری)
Revolut tag|Tag Revolut|Тег Revolut|معرّف Revolut|Revolut टैग|Revolut ٹیگ
Six-digit code|Codice a sei cifre|Шестизначный код|الرمز المكوّن من ستة أرقام|छह अंकों का कोड|چھ ہندسوں کا کوڈ
Verify code|Verifica il codice|Проверить код|تحقّق من الرمز|कोड सत्यापित करें|کوڈ کی تصدیق کریں
Send code again|Invia di nuovo il codice|Отправить код ещё раз|أرسل الرمز مجددًا|कोड फिर भेजें|کوڈ دوبارہ بھیجیں
Resend code|Reinvia il codice|Отправить код повторно|أعد إرسال الرمز|कोड फिर भेजें|کوڈ دوبارہ بھیجیں
Read the draft Terms & Conditions|Leggi la bozza dei Termini e condizioni|Прочитать проект условий|اقرأ مسودة الشروط والأحكام|नियमों और शर्तों का मसौदा पढ़ें|شرائط و ضوابط کا مسودہ پڑھیں
I accept the draft Terms & Conditions.|Accetto la bozza dei Termini e condizioni.|Я принимаю проект условий.|أوافق على مسودة الشروط والأحكام.|मैं नियमों और शर्तों का मसौदा स्वीकार करता हूँ।|میں شرائط و ضوابط کا مسودہ قبول کرتا ہوں۔
Help & FAQ|Aiuto e domande frequenti|Помощь и частые вопросы|المساعدة والأسئلة الشائعة|सहायता और अक्सर पूछे जाने वाले सवाल|مدد اور عام سوالات
Getting started|Per iniziare|Начало работы|البدء|शुरुआत करें|شروع کریں
Choose your role|Scegli il tuo ruolo|Выберите свою роль|اختر دورك|अपनी भूमिका चुनें|اپنا کردار منتخب کریں
Arrange a pickup|Organizza un ritiro|Договоритесь о вывозе|رتّب عملية استلام|पिकअप तय करें|پک اپ طے کریں
Complete the handover|Completa la consegna|Завершите передачу|أتمّ التسليم|सौंपने की प्रक्रिया पूरी करें|حوالگی مکمل کریں
Back|Indietro|Назад|رجوع|वापस|واپس
Next|Avanti|Далее|التالي|आगे|آگے
Done|Fatto|Готово|تم|हो गया|ہو گیا
Skip|Salta|Пропустить|تخطَّ|छोड़ें|چھوڑیں
Close|Chiudi|Закрыть|إغلاق|बंद करें|بند کریں
Cancel|Annulla|Отмена|إلغاء|रद्द करें|منسوخ کریں
Refresh|Aggiorna|Обновить|تحديث|रीफ़्रेश करें|تازہ کریں
Notifications|Notifiche|Уведомления|الإشعارات|सूचनाएँ|اطلاعات
Recent activity|Attività recenti|Недавние действия|النشاط الأخير|हाल की गतिविधि|حالیہ سرگرمی
Mark all as read|Segna tutto come letto|Отметить всё прочитанным|علّم الكل كمقروء|सभी को पढ़ा हुआ चिह्नित करें|سب کو پڑھا ہوا نشان زد کریں
No activity yet.|Nessuna attività per ora.|Пока нет действий.|لا يوجد نشاط بعد.|अभी कोई गतिविधि नहीं है।|ابھی کوئی سرگرمی نہیں۔
Enable lock screen alerts|Attiva avvisi sulla schermata di blocco|Включить уведомления на экране блокировки|فعّل تنبيهات شاشة القفل|लॉक स्क्रीन सूचनाएँ चालू करें|لاک اسکرین کی اطلاعات آن کریں
Turn off lock screen alerts|Disattiva avvisi sulla schermata di blocco|Выключить уведомления на экране блокировки|أوقف تنبيهات شاشة القفل|लॉक स्क्रीन सूचनाएँ बंद करें|لاک اسکرین کی اطلاعات بند کریں
Balance|Saldo|Баланс|الرصيد|बैलेंस|بیلنس
Estimated earnings|Guadagni stimati|Ожидаемый доход|الأرباح التقديرية|अनुमानित कमाई|تخمینی آمدنی
Total deposit value|Valore totale della cauzione|Общая залоговая стоимость|إجمالي قيمة الوديعة|कुल जमा राशि|جمع شدہ رقم کی کل قدر
Completed pickup history|Storico dei ritiri completati|История завершённых вывозов|سجل عمليات الاستلام المكتملة|पूरे हुए पिकअप का इतिहास|مکمل پک اپ کی تاریخ
No completed pickups yet.|Nessun ritiro completato.|Завершённых вывозов пока нет.|لا توجد عمليات استلام مكتملة بعد.|अभी कोई पिकअप पूरा नहीं हुआ है।|ابھی کوئی پک اپ مکمل نہیں ہوا۔
Your Recycling Impact|Il tuo impatto sul riciclo|Ваш вклад в переработку|أثرك في إعادة التدوير|रीसाइक्लिंग में आपका योगदान|ری سائیکلنگ میں آپ کا حصہ
Containers handed over|Contenitori consegnati|Передано единиц тары|العبوات المسلّمة|सौंपी गई बोतलें और डिब्बे|حوالے کی گئی بوتلیں اور ڈبے
Recorded handovers|Consegne registrate|Зарегистрировано передач|عمليات التسليم المسجّلة|दर्ज की गई सुपुर्दगी|درج شدہ حوالگیاں
Dismiss|Ignora|Закрыть|إخفاء|बंद करें|بند کریں
First completed pickup|Primo ritiro completato|Первый завершённый вывоз|أول عملية استلام مكتملة|पहला पिकअप पूरा हुआ|پہلا پک اپ مکمل ہوا
Account access|Accesso all’account|Доступ к аккаунту|الوصول إلى الحساب|खाते की पहुँच|اکاؤنٹ تک رسائی
Deactivate account|Disattiva account|Деактивировать аккаунт|أوقف الحساب مؤقتًا|खाता निष्क्रिय करें|اکاؤنٹ غیر فعال کریں
Reactivate account|Riattiva account|Активировать аккаунт|أعد تفعيل الحساب|खाता फिर सक्रिय करें|اکاؤنٹ دوبارہ فعال کریں
Delete account|Elimina account|Удалить аккаунт|احذف الحساب|खाता मिटाएँ|اکاؤنٹ حذف کریں
Delete permanently|Elimina definitivamente|Удалить навсегда|احذف نهائيًا|हमेशा के लिए मिटाएँ|مستقل طور پر حذف کریں
Open Settings|Apri Impostazioni|Открыть настройки|افتح الإعدادات|सेटिंग्स खोलें|ترتیبات کھولیں
Pickup privacy|Privacy del ritiro|Конфиденциальность вывоза|خصوصية الاستلام|पिकअप की गोपनीयता|پک اپ کی رازداری
Share my phone number|Condividi il mio numero|Поделиться моим номером|شارك رقم هاتفي|मेरा फ़ोन नंबर साझा करें|میرا فون نمبر شیئر کریں
Blocked accounts|Account bloccati|Заблокированные аккаунты|الحسابات المحظورة|ब्लॉक किए गए खाते|بلاک کیے گئے اکاؤنٹس
Block account|Blocca account|Заблокировать аккаунт|احظر الحساب|खाता ब्लॉक करें|اکاؤنٹ بلاک کریں
Unblock|Sblocca|Разблокировать|ألغِ الحظر|अनब्लॉक करें|بلاک ختم کریں
Show saved listings|Mostra gli annunci salvati|Показать сохранённые объявления|اعرض الإعلانات المحفوظة|सहेजे गए विज्ञापन दिखाएँ|محفوظ اشتہار دکھائیں
Show all listings|Mostra tutti gli annunci|Показать все объявления|اعرض كل الإعلانات|सभी विज्ञापन दिखाएँ|تمام اشتہار دکھائیں
Save favorite|Aggiungi ai preferiti|Сохранить в избранном|احفظ في المفضلة|पसंदीदा में सहेजें|پسندیدہ میں محفوظ کریں
Remove favorite|Rimuovi dai preferiti|Убрать из избранного|أزِل من المفضلة|पसंदीदा से हटाएँ|پسندیدہ سے ہٹائیں
Show archived listings|Mostra gli annunci archiviati|Показать архив объявлений|اعرض الإعلانات المؤرشفة|संग्रहीत विज्ञापन दिखाएँ|آرکائیو کیے گئے اشتہار دکھائیں
Show current listings|Mostra gli annunci attuali|Показать текущие объявления|اعرض الإعلانات الحالية|मौजूदा विज्ञापन दिखाएँ|موجودہ اشتہار دکھائیں
Archive listing|Archivia annuncio|Архивировать объявление|أرشف الإعلان|विज्ञापन संग्रह में डालें|اشتہار آرکائیو کریں
Restore listing|Ripristina annuncio|Восстановить объявление|استعد الإعلان|विज्ञापन बहाल करें|اشتہار بحال کریں
Report listing|Segnala annuncio|Пожаловаться на объявление|أبلغ عن الإعلان|विज्ञापन की शिकायत करें|اشتہار کی شکایت کریں
Report pickup partner|Segnala il partecipante|Пожаловаться на участника|أبلغ عن الطرف الآخر|पिकअप साथी की शिकायत करें|پک اپ کے ساتھی کی شکایت کریں
Describe the issue|Descrivi il problema|Опишите проблему|صِف المشكلة|समस्या बताएँ|مسئلے کی وضاحت کریں
Submit report|Invia segnalazione|Отправить жалобу|أرسل البلاغ|शिकायत भेजें|شکایت بھیجیں
Report sent to the BottleForMe team.|Segnalazione inviata al team di BottleForMe.|Жалоба отправлена команде BottleForMe.|تم إرسال البلاغ إلى فريق BottleForMe.|शिकायत BottleForMe टीम को भेज दी गई है।|شکایت BottleForMe ٹیم کو بھیج دی گئی ہے۔
Pickup partner|Partecipante al ritiro|Участник вывоза|الطرف الآخر في الاستلام|पिकअप साथी|پک اپ کا ساتھی
Your rating|La tua valutazione|Ваша оценка|تقييمك|आपकी रेटिंग|آپ کی درجہ بندی
Your rating out of five|La tua valutazione su cinque|Ваша оценка из пяти|تقييمك من خمسة|पाँच में से आपकी रेटिंग|پانچ میں سے آپ کی درجہ بندی
Review (optional)|Recensione (facoltativa)|Отзыв (необязательно)|المراجعة (اختيارية)|समीक्षा (वैकल्पिक)|جائزہ (اختیاری)
Submit review|Invia recensione|Отправить отзыв|أرسل المراجعة|समीक्षा भेजें|جائزہ بھیجیں
Update review|Modifica recensione|Обновить отзыв|حدّث المراجعة|समीक्षा अपडेट करें|جائزہ اپ ڈیٹ کریں
No ratings yet|Nessuna valutazione|Оценок пока нет|لا توجد تقييمات بعد|अभी कोई रेटिंग नहीं|ابھی کوئی درجہ بندی نہیں
Review saved.|Recensione salvata.|Отзыв сохранён.|تم حفظ المراجعة.|समीक्षा सहेज दी गई है।|جائزہ محفوظ ہو گیا۔
List|Elenco|Список|القائمة|सूची|فہرست
Feed|Elenco|Лента|القائمة|सूची|فہرست
Map|Mappa|Карта|الخريطة|मानचित्र|نقشہ
All localities|Tutte le località|Все районы|كل المناطق|सभी इलाके|تمام علاقے
Locality|Località|Район|المنطقة|इलाका|علاقہ
Pickup locality|Località del ritiro|Район вывоза|منطقة الاستلام|पिकअप का इलाका|پک اپ کا علاقہ
Choose a locality|Scegli una località|Выберите район|اختر منطقة|इलाका चुनें|علاقہ منتخب کریں
Pickup address|Indirizzo del ritiro|Адрес вывоза|عنوان الاستلام|पिकअप का पता|پک اپ کا پتہ
Request pickup|Richiedi ritiro|Запросить вывоз|اطلب الاستلام|पिकअप का अनुरोध करें|پک اپ کی درخواست دیں
Reserve pickup →|Prenota il ritiro →|Забронировать вывоз →|احجز الاستلام|पिकअप बुक करें|پک اپ بک کریں
Pickup request blocked|Richiesta di ritiro bloccata|Запрос на вывоз заблокирован|طلب الاستلام محظور|पिकअप का अनुरोध रोका गया|پک اپ کی درخواست روک دی گئی
Go to Pickup|Vai al ritiro|Открыть вывоз|افتح عملية الاستلام|पिकअप खोलें|پک اپ کھولیں
Go to Pickups|Vai ai ritiri|Перейти к вывозам|افتح عمليات الاستلام|पिकअप सूची खोलें|پک اپ کی فہرست کھولیں
Pickup date|Data del ritiro|Дата вывоза|تاريخ الاستلام|पिकअप की तारीख|پک اپ کی تاریخ
Pickup time|Ora del ritiro|Время вывоза|وقت الاستلام|पिकअप का समय|پک اپ کا وقت
Available time|Orario disponibile|Доступное время|وقت متاح|उपलब्ध समय|دستیاب وقت
Available date|Data disponibile|Доступная дата|تاريخ متاح|उपलब्ध तारीख|دستیاب تاریخ
Choose a time|Scegli un orario|Выберите время|اختر وقتًا|समय चुनें|وقت منتخب کریں
Propose another time|Proponi un altro orario|Предложить другое время|اقترح وقتًا آخر|दूसरा समय सुझाएँ|دوسرا وقت تجویز کریں
Send request|Invia richiesta|Отправить запрос|أرسل الطلب|अनुरोध भेजें|درخواست بھیجیں
Accept|Accetta|Принять|قبول|स्वीकार करें|قبول کریں
Decline|Rifiuta|Отклонить|رفض|अस्वीकार करें|رد کریں
Suggest another time|Suggerisci un altro orario|Предложить другое время|اقترح وقتًا آخر|दूसरा समय सुझाएँ|دوسرا وقت تجویز کریں
Cancel arrangement|Annulla accordo|Отменить договорённость|ألغِ الترتيب|तय समय रद्द करें|طے شدہ وقت منسوخ کریں
Cancel pickup|Annulla ritiro|Отменить вывоз|ألغِ الاستلام|पिकअप रद्द करें|پک اپ منسوخ کریں
Details|Dettagli|Детали|التفاصيل|विवरण|تفصیلات
Pending|In attesa|Ожидает ответа|قيد الانتظار|लंबित|زیرِ التوا
Accepted|Accettato|Принято|مقبول|स्वीकृत|قبول شدہ
Open|Disponibile|Доступно|متاح|उपलब्ध|دستیاب
Reserved|Prenotato|Забронировано|محجوز|बुक किया गया|بک شدہ
On the way|In arrivo|В пути|في الطريق|रास्ते में|راستے میں
Arrived|Arrivato|Прибыл|وصل|पहुँच गए|پہنچ گئے
Completed|Completato|Завершено|مكتمل|पूरा हुआ|مکمل
Cancelled|Annullato|Отменено|ملغى|रद्द|منسوخ
Expired|Scaduto|Истекло|منتهي الصلاحية|समय समाप्त|وقت ختم
Archived|Archiviato|В архиве|مؤرشف|संग्रहीत|آرکائیو شدہ
Overdue|In ritardo|Просрочено|متأخر|समय से अधिक देर|تاخیر شدہ
Mark on the way|Segna come in arrivo|Отметить «В пути»|ضع علامة «في الطريق»|रास्ते में चिह्नित करें|راستے میں نشان زد کریں
Mark arrived|Segna come arrivato|Отметить «Прибыл»|ضع علامة «وصل»|पहुँच गए चिह्नित करें|پہنچ گئے نشان زد کریں
Confirm handover|Conferma la consegna|Подтвердить передачу|أكّد التسليم|सौंपने की पुष्टि करें|حوالگی کی تصدیق کریں
Complete handover|Completa la consegna|Завершить передачу|أتمّ التسليم|सौंपना पूरा करें|حوالگی مکمل کریں
Show code|Mostra codice|Показать код|اعرض الرمز|कोड दिखाएँ|کوڈ دکھائیں
Show handover code|Mostra il codice di consegna|Показать код передачи|اعرض رمز التسليم|सौंपने का कोड दिखाएँ|حوالگی کا کوڈ دکھائیں
Photo of the bottles or bags (required)|Foto delle bottiglie o dei sacchi (obbligatoria)|Фото бутылок или пакетов (обязательно)|صورة الزجاجات أو الأكياس (مطلوبة)|बोतलों या थैलों की फ़ोटो (ज़रूरी)|بوتلوں یا تھیلوں کی تصویر (لازمی)
Choose photo|Scegli una foto|Выберите фото|اختر صورة|फ़ोटो चुनें|تصویر منتخب کریں
Replace photo|Sostituisci la foto|Заменить фото|استبدل الصورة|फ़ोटो बदलें|تصویر تبدیل کریں
Remove photo|Rimuovi la foto|Удалить фото|أزل الصورة|फ़ोटो हटाएँ|تصویر ہٹائیں
Show listing photo|Mostra la foto dell’annuncio|Показать фото объявления|اعرض صورة الإعلان|विज्ञापन की फ़ोटो दिखाएँ|اشتہار کی تصویر دکھائیں
Bag arrangements|Condizioni per i sacchi|Условия для пакетов|شروط الأكياس|थैलों की शर्तें|تھیلوں کی شرائط
Choose an option|Scegli un’opzione|Выберите вариант|اختر خيارًا|विकल्प चुनें|ایک اختیار منتخب کریں
Publish Collection Request|Pubblica la richiesta di ritiro|Опубликовать объявление|انشر طلب الجمع|पिकअप का विज्ञापन प्रकाशित करें|پک اپ کا اشتہار شائع کریں
Message|Messaggio|Сообщение|الرسالة|संदेश|پیغام
Send message|Invia messaggio|Отправить сообщение|أرسل الرسالة|संदेश भेजें|پیغام بھیجیں
Chat|Chat|Чат|المحادثة|चैट|چیٹ
Open chat|Apri chat|Открыть чат|افتح المحادثة|चैट खोलें|چیٹ کھولیں
Chat history|Cronologia chat|История чата|سجل المحادثة|चैट का इतिहास|چیٹ کی تاریخ
No messages yet.|Nessun messaggio per ora.|Сообщений пока нет.|لا توجد رسائل بعد.|अभी कोई संदेश नहीं है।|ابھی کوئی پیغام نہیں۔
This conversation is read-only.|Questa conversazione è di sola lettura.|Этот чат доступен только для чтения.|هذه المحادثة للقراءة فقط.|इस चैट को सिर्फ़ पढ़ सकते हैं।|یہ چیٹ صرف پڑھنے کے لیے ہے۔
Sign in to view pickups|Accedi per vedere i ritiri|Войдите, чтобы увидеть вывозы|سجّل الدخول لعرض عمليات الاستلام|पिकअप देखने के लिए लॉग इन करें|پک اپ دیکھنے کے لیے لاگ ان کریں

How do I list bottles or cans?|Come pubblico bottiglie o lattine?|Как разместить бутылки или банки?|كيف أعرض الزجاجات أو العلب؟|मैं बोतलें या डिब्बे कैसे सूचीबद्ध करूँ?|میں بوتلوں یا ڈبوں کا اشتہار کیسے دوں؟
Switch to Giver, open List Empties, enter the container and bag quantities, and choose your pickup address and available times.|Passa a Donatore, apri Pubblica i vuoti, inserisci le quantità di contenitori e sacchi e scegli l’indirizzo e gli orari disponibili.|Переключитесь на дарителя, откройте «Разместить тару», укажите количество тары и пакетов, адрес и доступное время.|انتقل إلى دور المعطي، وافتح إضافة العبوات الفارغة، ثم أدخل عدد العبوات والأكياس واختر عنوان الاستلام والأوقات المتاحة.|देने वाले की भूमिका चुनें, खाली बोतलों की सूची खोलें, बोतलों और थैलों की संख्या डालें और पिकअप का पता और उपलब्ध समय चुनें।|دینے والے کا کردار منتخب کریں، خالی بوتلوں کا اشتہار کھولیں، بوتلوں اور تھیلوں کی تعداد درج کریں اور پک اپ کا پتہ اور دستیاب اوقات منتخب کریں۔
How do I request a pickup?|Come richiedo un ritiro?|Как запросить вывоз?|كيف أطلب الاستلام؟|मैं पिकअप का अनुरोध कैसे करूँ?|میں پک اپ کی درخواست کیسے دوں؟
Switch to Taker and open Radar. Select a listing and request an available time. The Giver can accept it or suggest another time.|Passa a Raccoglitore e apri Radar. Seleziona un annuncio e richiedi un orario disponibile. Il donatore può accettarlo o proporne un altro.|Переключитесь на сборщика и откройте «Радар». Выберите объявление и запросите доступное время. Даритель может согласиться или предложить другое время.|انتقل إلى دور الجامع وافتح الرادار. اختر إعلانًا واطلب وقتًا متاحًا. يمكن للمعطي قبوله أو اقتراح وقت آخر.|इकट्ठा करने वाले की भूमिका चुनें और रडार खोलें। विज्ञापन और उपलब्ध समय चुनें। देने वाला समय स्वीकार कर सकता है या दूसरा समय सुझा सकता है।|جمع کرنے والے کا کردار منتخب کریں اور ریڈار کھولیں۔ اشتہار اور دستیاب وقت منتخب کریں۔ دینے والا اسے قبول کر سکتا ہے یا دوسرا وقت تجویز کر سکتا ہے۔
How do I confirm a handover?|Come confermo una consegna?|Как подтвердить передачу?|كيف أؤكّد التسليم؟|मैं सौंपने की पुष्टि कैसे करूँ?|میں حوالگی کی تصدیق کیسے کروں؟
At the pickup, the Giver shows the handover code. The Taker enters it in Pickups after receiving the containers.|Al ritiro, il donatore mostra il codice di consegna. Il raccoglitore lo inserisce in Ritiri dopo aver ricevuto i contenitori.|При встрече даритель показывает код передачи. После получения тары сборщик вводит его в разделе «Вывозы».|عند الاستلام، يعرض المعطي رمز التسليم. يُدخله الجامع في عمليات الاستلام بعد استلام العبوات.|पिकअप पर देने वाला कोड दिखाता है। बोतलें लेने के बाद इकट्ठा करने वाला पिकअप में कोड दर्ज करता है।|پک اپ کے وقت دینے والا حوالگی کوڈ دکھاتا ہے۔ بوتلیں وصول کرنے کے بعد جمع کرنے والا اسے پک اپ میں درج کرتا ہے۔
How are payments handled?|Come si effettuano i pagamenti?|Как происходит оплата?|كيف تتم المدفوعات؟|भुगतान कैसे होता है?|ادائیگی کیسے ہوتی ہے؟
The listing shows the estimated deposit value and any amount due to the Giver. Arrange payment directly with the other participant.|L’annuncio indica il valore stimato della cauzione e l’eventuale importo dovuto al donatore. Accorda il pagamento direttamente con l’altra persona.|В объявлении указаны примерная залоговая стоимость и сумма к выплате дарителю. Договоритесь об оплате напрямую со вторым участником.|يعرض الإعلان قيمة الوديعة التقديرية وأي مبلغ مستحق للمعطي. اتفق على الدفع مباشرة مع الطرف الآخر.|विज्ञापन में अनुमानित जमा राशि और देने वाले को देय रकम दिखती है। भुगतान सीधे दूसरे व्यक्ति के साथ तय करें।|اشتہار میں جمع شدہ رقم کا تخمینہ اور دینے والے کو واجب الادا رقم دکھائی جاتی ہے۔ ادائیگی براہ راست دوسرے شریک سے طے کریں۔
How do I reset my password?|Come reimposto la password?|Как сбросить пароль?|كيف أعيد تعيين كلمة المرور؟|मैं पासवर्ड कैसे रीसेट करूँ?|میں پاس ورڈ کیسے ری سیٹ کروں؟
Open Log in, select Forgot password and follow the instructions in the email.|Apri Accedi, seleziona Password dimenticata e segui le istruzioni nell’email.|Откройте окно входа, выберите «Забыли пароль» и следуйте инструкциям из письма.|افتح تسجيل الدخول، واختر نسيت كلمة المرور، واتبع التعليمات في البريد الإلكتروني.|लॉग इन खोलें, पासवर्ड भूल गए चुनें और ईमेल के निर्देशों का पालन करें।|لاگ ان کھولیں، پاس ورڈ بھول گئے منتخب کریں اور ای میل میں دی گئی ہدایات پر عمل کریں۔
Givers list containers. Takers find and collect them. You can switch roles from Profile.|I donatori pubblicano i contenitori. I raccoglitori li trovano e li ritirano. Puoi cambiare ruolo dal Profilo.|Дарители размещают тару. Сборщики находят и забирают её. Роль можно изменить в профиле.|يعرض المعطون العبوات ويبحث عنها الجامعون لاستلامها. يمكنك تغيير دورك من ملفك الشخصي.|देने वाले बोतलें सूचीबद्ध करते हैं। इकट्ठा करने वाले उन्हें ढूँढकर ले जाते हैं। प्रोफ़ाइल से भूमिका बदल सकते हैं।|دینے والے بوتلوں کا اشتہار دیتے ہیں اور جمع کرنے والے انہیں تلاش کر کے لے جاتے ہیں۔ پروفائل سے کردار تبدیل کیا جا سکتا ہے۔
As a Giver, list your containers and available times. As a Taker, open Radar, choose a listing and request a time.|Come donatore, pubblica i contenitori e gli orari disponibili. Come raccoglitore, apri Radar, scegli un annuncio e richiedi un orario.|Даритель указывает тару и доступное время. Сборщик открывает «Радар», выбирает объявление и запрашивает время.|بصفتك معطيًا، أضف العبوات والأوقات المتاحة. وبصفتك جامعًا، افتح الرادار واختر إعلانًا واطلب وقتًا.|देने वाले बोतलें और उपलब्ध समय डालें। इकट्ठा करने वाले रडार खोलें, विज्ञापन चुनें और समय का अनुरोध करें।|دینے والے بوتلیں اور دستیاب اوقات درج کریں۔ جمع کرنے والے ریڈار کھولیں، اشتہار منتخب کریں اور وقت کی درخواست دیں۔
Open Pickups to check the time and message your partner. At the handover, the Giver shows the code and the Taker enters it after receiving the containers.|Apri Ritiri per verificare l’orario e scrivere all’altra persona. Alla consegna, il donatore mostra il codice e il raccoglitore lo inserisce dopo aver ricevuto i contenitori.|Откройте «Вывозы», чтобы проверить время и написать второму участнику. При передаче даритель показывает код, а сборщик вводит его после получения тары.|افتح عمليات الاستلام للتحقّق من الوقت ومراسلة الطرف الآخر. عند التسليم يعرض المعطي الرمز، ويُدخله الجامع بعد استلام العبوات.|समय देखने और साथी को संदेश भेजने के लिए पिकअप खोलें। सुपुर्दगी पर देने वाला कोड दिखाता है और इकट्ठा करने वाला बोतलें लेने के बाद उसे दर्ज करता है।|وقت دیکھنے اور ساتھی کو پیغام بھیجنے کے لیے پک اپ کھولیں۔ حوالگی پر دینے والا کوڈ دکھاتا ہے اور جمع کرنے والا بوتلیں وصول کرنے کے بعد اسے درج کرتا ہے۔
Switch Active Role|Cambia ruolo attivo|Сменить активную роль|غيّر دورك الحالي|मौजूदा भूमिका बदलें|موجودہ کردار بدلیں
Switch to Giver|Passa a Donatore|Переключиться на дарителя|انتقل إلى دور المعطي|देने वाले की भूमिका चुनें|دینے والے کا کردار منتخب کریں
Switch to Taker|Passa a Raccoglitore|Переключиться на сборщика|انتقل إلى دور الجامع|इकट्ठा करने वाले की भूमिका चुनें|جمع کرنے والے کا کردار منتخب کریں
Payment & Contact Info|Pagamenti e contatti|Оплата и контакты|الدفع ومعلومات الاتصال|भुगतान और संपर्क|ادائیگی اور رابطے کی معلومات
Default Locality|Località predefinita|Район по умолчанию|المنطقة الافتراضية|डिफ़ॉल्ट इलाका|طے شدہ علاقہ
Update profile photo|Aggiorna la foto del profilo|Обновить фото профиля|حدّث صورة الملف الشخصي|प्रोफ़ाइल फ़ोटो बदलें|پروفائل تصویر بدلیں
Open Revolut|Apri Revolut|Открыть Revolut|افتح Revolut|Revolut खोलें|Revolut کھولیں
Private pickup instructions|Istruzioni private per il ritiro|Личные инструкции для вывоза|تعليمات خاصة للاستلام|पिकअप के निजी निर्देश|پک اپ کی نجی ہدایات
Nearby street|Via vicina|Ближайшая улица|شارع قريب|पास की सड़क|قریبی گلی
Choose a street|Scegli una via|Выберите улицу|اختر شارعًا|सड़क चुनें|گلی منتخب کریں
Use GPS|Usa GPS|Использовать GPS|استخدم GPS|GPS इस्तेमाल करें|GPS استعمال کریں
Containers to hand over|Contenitori da consegnare|Тара для передачи|العبوات المراد تسليمها|सौंपने के लिए बोतलें और डिब्बे|حوالے کرنے کے لیے بوتلیں اور ڈبے
Containers to Hand Over:|Contenitori da consegnare:|Тара для передачи:|العبوات المراد تسليمها:|सौंपने के लिए बोतलें और डिब्बे:|حوالے کرنے کے لیے بوتلیں اور ڈبے:
Pickup bags|Sacchi per il ritiro|Пакеты для вывоза|أكياس الاستلام|पिकअप के थैले|پک اپ کے تھیلے
Pickup bags ·|Sacchi per il ritiro ·|Пакеты для вывоза ·|أكياس الاستلام ·|पिकअप के थैले ·|پک اپ کے تھیلے ·
Deposit Split Ratio|Ripartizione della cauzione|Доля залога|نسبة تقسيم الوديعة|जमा राशि का बँटवारा|جمع شدہ رقم کی تقسیم
Estimated BCRS voucher value|Valore stimato del buono BCRS|Примерная стоимость ваучера BCRS|القيمة التقديرية لقسيمة BCRS|BCRS वाउचर का अनुमानित मूल्य|BCRS واؤچر کی تخمینی قدر
Collector’s estimated net value|Valore netto stimato per chi ritira|Примерный чистый доход сборщика|صافي القيمة التقديرية للجامع|इकट्ठा करने वाले की अनुमानित शुद्ध रकम|جمع کرنے والے کی تخمینی خالص رقم
Location & Contact Details|Posizione e recapiti|Место и контактные данные|الموقع وبيانات الاتصال|स्थान और संपर्क की जानकारी|مقام اور رابطے کی تفصیلات
No saved listings in this area.|Nessun annuncio salvato in questa zona.|В этом районе нет сохранённых объявлений.|لا توجد إعلانات محفوظة في هذه المنطقة.|इस इलाके में कोई सहेजा गया विज्ञापन नहीं है।|اس علاقے میں کوئی محفوظ اشتہار نہیں۔
No available pickups in this area.|Nessun ritiro disponibile in questa zona.|В этом районе нет доступных вывозов.|لا توجد عمليات استلام متاحة في هذه المنطقة.|इस इलाके में कोई पिकअप उपलब्ध नहीं है।|اس علاقے میں کوئی پک اپ دستیاب نہیں۔
No archived listings yet.|Nessun annuncio archiviato.|Архивированных объявлений пока нет.|لا توجد إعلانات مؤرشفة بعد.|अभी कोई संग्रहीत विज्ञापन नहीं है।|ابھی کوئی اشتہار آرکائیو نہیں کیا گیا۔
No pickups in this role yet.|Nessun ritiro per questo ruolo.|Для этой роли пока нет вывозов.|لا توجد عمليات استلام لهذا الدور بعد.|इस भूमिका में अभी कोई पिकअप नहीं है।|اس کردار میں ابھی کوئی پک اپ نہیں۔
This listing has no photo.|Questo annuncio non ha una foto.|В объявлении нет фото.|لا توجد صورة لهذا الإعلان.|इस विज्ञापन में फ़ोटो नहीं है।|اس اشتہار میں تصویر نہیں ہے۔
Preparing photo…|Preparazione della foto…|Подготовка фото…|جارٍ تجهيز الصورة…|फ़ोटो तैयार हो रही है…|تصویر تیار ہو رہی ہے…
Loading photo…|Caricamento foto…|Загрузка фото…|جارٍ تحميل الصورة…|फ़ोटो लोड हो रही है…|تصویر لوڈ ہو رہی ہے…
Loading settings…|Caricamento impostazioni…|Загрузка настроек…|جارٍ تحميل الإعدادات…|सेटिंग्स लोड हो रही हैं…|ترتیبات لوڈ ہو رہی ہیں…
Loading chat…|Caricamento chat…|Загрузка чата…|جارٍ تحميل المحادثة…|चैट लोड हो रही है…|چیٹ لوڈ ہو رہی ہے…
Loading your pickups…|Caricamento dei ritiri…|Загрузка вывозов…|جارٍ تحميل عمليات الاستلام…|आपके पिकअप लोड हो रहे हैं…|آپ کے پک اپ لوڈ ہو رہے ہیں…
Loading your profile…|Caricamento del profilo…|Загрузка профиля…|جارٍ تحميل الملف الشخصي…|प्रोफ़ाइल लोड हो रही है…|پروفائل لوڈ ہو رہا ہے…
Save availability|Salva disponibilità|Сохранить доступное время|احفظ الأوقات المتاحة|उपलब्ध समय सहेजें|دستیاب اوقات محفوظ کریں
Edit availability|Modifica disponibilità|Изменить доступное время|عدّل الأوقات المتاحة|उपलब्ध समय बदलें|دستیاب اوقات تبدیل کریں
Add a window|Aggiungi una fascia oraria|Добавить интервал|أضف فترة زمنية|समय की एक अवधि जोड़ें|وقت کا وقفہ شامل کریں
Remove window|Rimuovi fascia oraria|Удалить интервал|أزل الفترة الزمنية|समय की अवधि हटाएँ|وقت کا وقفہ ہٹائیں
From|Da|С|من|से|سے
Until|Fino a|До|إلى|तक|تک
Remove|Rimuovi|Удалить|إزالة|हटाएँ|ہٹائیں
Time requests|Richieste di orario|Запросы времени|طلبات الوقت|समय के अनुरोध|وقت کی درخواستیں
Pickup arrangements|Accordi per il ritiro|Договорённости о вывозе|ترتيبات الاستلام|पिकअप की व्यवस्था|پک اپ کے انتظامات
Send new time|Invia nuovo orario|Отправить новое время|أرسل الوقت الجديد|नया समय भेजें|نیا وقت بھیجیں
No upcoming windows. You can propose another time.|Nessuna fascia oraria disponibile. Puoi proporre un altro orario.|Нет ближайших доступных интервалов. Можно предложить другое время.|لا توجد فترات متاحة قريبة. يمكنك اقتراح وقت آخر.|कोई आगामी समय उपलब्ध नहीं है। आप दूसरा समय सुझा सकते हैं।|آنے والا کوئی وقت دستیاب نہیں۔ آپ دوسرا وقت تجویز کر سکتے ہیں۔
Confirm handover code|Conferma il codice di consegna|Подтвердить код передачи|أكّد رمز التسليم|सौंपने का कोड सत्यापित करें|حوالگی کوڈ کی تصدیق کریں
Enter the six-digit code from the Giver|Inserisci il codice a sei cifre del donatore|Введите шестизначный код дарителя|أدخل الرمز المكوّن من ستة أرقام من المعطي|देने वाले का छह अंकों का कोड डालें|دینے والے کا چھ ہندسوں کا کوڈ درج کریں
Six-digit code shown by the Giver|Codice a sei cifre mostrato dal donatore|Шестизначный код, который показывает даритель|الرمز المكوّن من ستة أرقام الذي يعرضه المعطي|देने वाले का दिखाया गया छह अंकों का कोड|دینے والے کا دکھایا ہوا چھ ہندسوں کا کوڈ
Free pickup|Ritiro gratuito|Бесплатный вывоз|استلام مجاني|मुफ़्त पिकअप|مفت پک اپ
Sign in to manage your account preferences.|Accedi per gestire le preferenze dell’account.|Войдите, чтобы изменить настройки аккаунта.|سجّل الدخول لإدارة تفضيلات حسابك.|खाते की प्राथमिकताएँ बदलने के लिए लॉग इन करें।|اکاؤنٹ کی ترجیحات تبدیل کرنے کے لیے لاگ ان کریں۔
Your account is deactivated.|Il tuo account è disattivato.|Ваш аккаунт деактивирован.|حسابك متوقف مؤقتًا.|आपका खाता निष्क्रिय है।|آپ کا اکاؤنٹ غیر فعال ہے۔
Deletion is pending.|Eliminazione in attesa.|Ожидается удаление.|الحذف قيد الانتظار.|खाता मिटाना लंबित है।|اکاؤنٹ حذف ہونا زیرِ التوا ہے۔
Retry account deletion|Riprova a eliminare l’account|Повторить удаление аккаунта|أعد محاولة حذف الحساب|खाता मिटाने का फिर प्रयास करें|اکاؤنٹ حذف کرنے کی دوبارہ کوشش کریں
Saved in this browser.|Salvato in questo browser.|Сохранено в этом браузере.|محفوظ في هذا المتصفح.|इस ब्राउज़र में सहेजा गया।|اس براؤزر میں محفوظ ہے۔
Saved on this device.|Salvato su questo dispositivo.|Сохранено на этом устройстве.|محفوظ على هذا الجهاز.|इस डिवाइस पर सहेजा गया।|اس ڈیوائس پر محفوظ ہے۔
You|Tu|Вы|أنت|आप|آپ

Plastic|Plastica|Пластик|بلاستيك|प्लास्टिक|پلاسٹک
Cans|Lattine|Банки|علب|डिब्बे|ڈبے
Glass|Vetro|Стекло|زجاج|काँच|شیشہ
Plastic · Cans · Glass Collection|Raccolta di plastica, lattine e vetro|Сбор пластика, банок и стекла|جمع البلاستيك والعلب والزجاج|प्लास्टिक, डिब्बे और काँच का संग्रह|پلاسٹک، ڈبوں اور شیشے کی وصولی
Arrange an empties pickup.|Organizza un ritiro di contenitori vuoti.|Организуйте вывоз пустой тары.|رتّب استلام العبوات الفارغة.|खाली बोतलों का पिकअप तय करें।|خالی بوتلوں کا پک اپ طے کریں۔
Zero Queues · Doorstep Pickup|Senza code · Ritiro a domicilio|Без очередей · Вывоз от двери|بلا طوابير · استلام من الباب|बिना कतार · दरवाज़े से पिकअप|بغیر قطار · دروازے سے پک اپ
€0.10 per eligible item|0,10 € per articolo idoneo|0,10 € за подходящую единицу|0.10 يورو لكل عبوة مؤهلة|हर पात्र बोतल या डिब्बे पर €0.10|ہر اہل بوتل یا ڈبے پر €0.10
Type exact count or tap − / +|Digita la quantità esatta o tocca − / +|Введите точное количество или нажмите − / +|أدخل العدد الدقيق أو اضغط − / +|सही संख्या लिखें या − / + दबाएँ|درست تعداد لکھیں یا − / + دبائیں
Count only empty containers accepted by Malta’s BCRS. Check for an eligible, readable barcode and keep the container intact.|Conta solo i vuoti accettati dal BCRS maltese. Controlla che il codice a barre sia idoneo e leggibile e mantieni il contenitore intatto.|Учитывайте только пустую тару, которую принимает BCRS Мальты. Убедитесь, что штрихкод подходит и читается, и не повреждайте тару.|احسب العبوات الفارغة التي يقبلها نظام BCRS في مالطا فقط. تحقّق من صلاحية الرمز الشريطي ووضوحه وحافظ على سلامة العبوة.|सिर्फ़ माल्टा के BCRS में स्वीकार होने वाली खाली बोतलें और डिब्बे गिनें। बारकोड पात्र और पढ़ने योग्य हो तथा बोतल या डिब्बा साबुत रहे।|صرف مالٹا کے BCRS میں قبول ہونے والی خالی بوتلیں اور ڈبے گنیں۔ بارکوڈ اہل اور پڑھنے کے قابل ہو اور بوتل یا ڈبہ سالم رہے۔
Total:|Totale:|Всего:|الإجمالي:|कुल:|کل:
eligible items|articoli idonei|подходящих единиц|عبوات مؤهلة|पात्र वस्तुएँ|اہل اشیا
−1 Bag|−1 sacco|−1 пакет|−1 كيس|−1 थैला|−1 تھیلا
+1 Bag|+1 sacco|+1 пакет|+1 كيس|+1 थैला|+1 تھیلا
Bags are included|I sacchi sono inclusi|Пакеты входят в комплект|الأكياس مشمولة|थैले शामिल हैं|تھیلے شامل ہیں
Giver keeps the bags|Il donatore tiene i sacchi|Даритель оставляет пакеты себе|يحتفظ المعطي بالأكياس|थैले देने वाले के पास रहेंगे|تھیلے دینے والے کے پاس رہیں گے
Taker must return the bags|Il raccoglitore deve restituire i sacchi|Сборщик должен вернуть пакеты|على الجامع إعادة الأكياس|इकट्ठा करने वाले को थैले लौटाने होंगे|جمع کرنے والے کو تھیلے واپس کرنا ہوں گے
Bag arrangements not specified|Condizioni per i sacchi non specificate|Условия для пакетов не указаны|شروط الأكياس غير محددة|थैलों की शर्तें नहीं दी गईं|تھیلوں کی شرائط درج نہیں
Choose what happens to the bags.|Indica cosa fare dei sacchi.|Укажите, что делать с пакетами.|حدّد ما سيحدث للأكياس.|बताएँ कि थैलों का क्या करना है।|بتائیں کہ تھیلوں کا کیا کرنا ہے۔
Specify the number of bags.|Indica il numero di sacchi.|Укажите число пакетов.|حدّد عدد الأكياس.|थैलों की संख्या बताएँ।|تھیلوں کی تعداد بتائیں۔
Add a photo of the bottles or bags.|Aggiungi una foto delle bottiglie o dei sacchi.|Добавьте фото бутылок или пакетов.|أضف صورة للزجاجات أو الأكياس.|बोतलों या थैलों की फ़ोटो जोड़ें।|بوتلوں یا تھیلوں کی تصویر شامل کریں۔
Listing photo preview|Anteprima foto dell’annuncio|Предпросмотр фото объявления|معاينة صورة الإعلان|विज्ञापन की फ़ोटो का पूर्वावलोकन|اشتہار کی تصویر کا پیش منظر
Seller share of estimated voucher value|Quota stimata del donatore|Доля дарителя от примерной стоимости ваучера|حصة المعطي من قيمة القسيمة التقديرية|अनुमानित वाउचर में देने वाले का हिस्सा|تخمینی واؤچر میں دینے والے کا حصہ
Voucher value minus seller payment|Valore del buono meno il pagamento al donatore|Стоимость ваучера за вычетом выплаты дарителю|قيمة القسيمة مطروحًا منها المبلغ المدفوع للمعطي|वाउचर की रकम में से देने वाले का भुगतान घटाकर|واؤچر کی رقم میں سے دینے والے کی ادائیگی منہا کر کے
Pay Giver:|Da pagare al donatore:|К выплате дарителю:|ادفع للمعطي:|देने वाले को भुगतान:|دینے والے کو ادائیگی:
Direct Revolut / Cash|Revolut o contanti|Revolut или наличные|Revolut أو نقدًا|Revolut या नकद|Revolut یا نقد
You Get (At Door)|Ricevi alla consegna|Вы получите при передаче|تستلم عند الباب|दरवाज़े पर मिलने वाली रकम|دروازے پر ملنے والی رقم
Malta Collector Radar|Radar dei raccoglitori di Malta|Радар сборщиков Мальты|رادار الجامعين في مالطا|माल्टा संग्रह रडार|مالٹا جمع کرنے والوں کا ریڈار
Live Pickup Requests|Richieste di ritiro attive|Активные запросы на вывоз|طلبات الاستلام النشطة|सक्रिय पिकअप अनुरोध|فعال پک اپ کی درخواستیں
Filter Radar by locality|Filtra Radar per località|Фильтровать по району|صفِّ الرادار حسب المنطقة|इलाके के अनुसार रडार फ़िल्टर करें|علاقے کے مطابق ریڈار فلٹر کریں
Pins show locality centers.|Gli indicatori mostrano il centro delle località.|Метки показывают центры районов.|تُظهر العلامات مراكز المناطق.|पिन इलाके का केंद्र दिखाते हैं।|پن علاقے کا مرکز دکھاتے ہیں۔
Radar is for Takers|Radar è per chi raccoglie|Радар для сборщиков|الرادار مخصّص للجامعين|रडार इकट्ठा करने वालों के लिए है|ریڈار جمع کرنے والوں کے لیے ہے
Switch to Taker to see and reserve pickups from other accounts.|Passa a Raccoglitore per vedere e prenotare i ritiri degli altri utenti.|Переключитесь на сборщика, чтобы видеть и бронировать чужие вывозы.|انتقل إلى دور الجامع لعرض عمليات الاستلام من الحسابات الأخرى وحجزها.|दूसरे खातों के पिकअप देखने और बुक करने के लिए इकट्ठा करने वाले की भूमिका चुनें।|دوسرے اکاؤنٹس کے پک اپ دیکھنے اور بک کرنے کے لیے جمع کرنے والے کا کردار منتخب کریں۔
Switch role|Cambia ruolo|Сменить роль|غيّر الدور|भूमिका बदलें|کردار بدلیں
Pickup availability · Malta time|Disponibilità per il ritiro · ora di Malta|Доступное время вывоза · время Мальты|الأوقات المتاحة للاستلام · توقيت مالطا|पिकअप की उपलब्धता · माल्टा का समय|پک اپ کی دستیابی · مالٹا کا وقت
Pickup schedule · Malta time|Orario del ritiro · ora di Malta|График вывоза · время Мальты|جدول الاستلام · توقيت مالطا|पिकअप का शेड्यूल · माल्टा का समय|پک اپ کا شیڈول · مالٹا کا وقت
Confirmed for|Confermato per|Подтверждено на|تم التأكيد لـ|इस समय के लिए पुष्टि हुई|اس وقت کے لیے تصدیق ہو گئی
Times are in Europe/Malta.|Gli orari sono nel fuso Europe/Malta.|Указано местное время Мальты.|الأوقات حسب توقيت أوروبا/مالطا.|समय माल्टा के समय क्षेत्र में हैं।|اوقات مالٹا کے ٹائم زون کے مطابق ہیں۔
Rejected|Rifiutato|Отклонено|مرفوض|अस्वीकृत|رد شدہ
Load earlier messages|Carica i messaggi precedenti|Загрузить ранние сообщения|حمّل الرسائل السابقة|पुराने संदेश लोड करें|پرانے پیغامات لوڈ کریں
Loading…|Caricamento…|Загрузка…|جارٍ التحميل…|लोड हो रहा है…|لوڈ ہو رہا ہے…
Saving…|Salvataggio…|Сохранение…|جارٍ الحفظ…|सहेजा जा रहा है…|محفوظ ہو رہا ہے…
Sending…|Invio…|Отправка…|جارٍ الإرسال…|भेजा जा रहा है…|بھیجا جا رہا ہے…
Publishing…|Pubblicazione…|Публикация…|جارٍ النشر…|प्रकाशित हो रहा है…|شائع ہو رہا ہے…
Pickup instructions are shared with the collector who reserves this listing.|Le istruzioni sono condivise con chi prenota il ritiro.|Инструкции доступны сборщику, который забронирует вывоз.|تُشارك تعليمات الاستلام مع الجامع الذي يحجز الإعلان.|पिकअप के निर्देश बुक करने वाले व्यक्ति के साथ साझा होते हैं।|پک اپ کی ہدایات اسے بک کرنے والے شخص سے شیئر کی جاتی ہیں۔
Door, intercom, or other instructions (optional)|Porta, citofono o altre istruzioni (facoltativo)|Дверь, домофон или другие инструкции (необязательно)|الباب أو جهاز الاتصال أو تعليمات أخرى (اختياري)|दरवाज़े, इंटरकॉम या अन्य निर्देश (वैकल्पिक)|دروازے، انٹرکام یا دیگر ہدایات (اختیاری)
Allow the other participant to see your phone number while a confirmed pickup is active. It stays hidden on Radar and after the pickup ends.|Consenti all’altra persona di vedere il tuo numero di telefono durante un ritiro confermato. Il numero resta nascosto su Radar e dopo il ritiro.|Разрешите второму участнику видеть ваш номер телефона во время подтверждённого вывоза. Номер скрыт на «Радаре» и после завершения вывоза.|اسمح للطرف الآخر برؤية رقم هاتفك ما دام الاستلام المؤكّد نشطًا. يظل الرقم مخفيًا في الرادار وبعد انتهاء الاستلام.|पुष्टि किए गए पिकअप के सक्रिय रहने तक दूसरे व्यक्ति को आपका फ़ोन नंबर दिखेगा। रडार और पिकअप खत्म होने के बाद नंबर छिपा रहता है।|تصدیق شدہ پک اپ کے فعال رہنے تک دوسرا شریک آپ کا فون نمبر دیکھ سکتا ہے۔ نمبر ریڈار پر اور پک اپ ختم ہونے کے بعد چھپا رہتا ہے۔
You haven’t blocked any accounts.|Non hai bloccato nessun account.|У вас нет заблокированных аккаунтов.|لم تحظر أي حساب.|आपने कोई खाता ब्लॉक नहीं किया है।|آپ نے کوئی اکاؤنٹ بلاک نہیں کیا۔
Loading blocked accounts…|Caricamento degli account bloccati…|Загрузка заблокированных аккаунтов…|جارٍ تحميل الحسابات المحظورة…|ब्लॉक किए गए खाते लोड हो रहे हैं…|بلاک کیے گئے اکاؤنٹس لوڈ ہو رہے ہیں…
Loading account status…|Caricamento dello stato dell’account…|Загрузка статуса аккаунта…|جارٍ تحميل حالة الحساب…|खाते की स्थिति लोड हो रही है…|اکاؤنٹ کی حالت لوڈ ہو رہی ہے…
Help with your account|Aiuto per il tuo account|Помощь с аккаунтом|مساعدة بخصوص حسابك|खाते में मदद|اکاؤنٹ سے متعلق مدد
BottleForMe is under maintenance. Pickup changes are paused. Please try again shortly.|BottleForMe è in manutenzione. Le modifiche ai ritiri sono sospese. Riprova tra poco.|В BottleForMe идут технические работы. Изменения вывозов приостановлены. Повторите попытку позже.|يخضع BottleForMe للصيانة. تعديلات الاستلام متوقفة مؤقتًا. حاول مرة أخرى قريبًا.|BottleForMe में रखरखाव चल रहा है। पिकअप में बदलाव अभी रुके हैं। थोड़ी देर बाद फिर कोशिश करें।|BottleForMe کی دیکھ بھال جاری ہے۔ پک اپ میں تبدیلیاں عارضی طور پر بند ہیں۔ کچھ دیر بعد دوبارہ کوشش کریں۔
This password reset link is no longer valid. Request a new link.|Questo link per reimpostare la password non è più valido. Richiedi un nuovo link.|Эта ссылка для сброса пароля больше не действует. Запросите новую.|لم يعد رابط إعادة تعيين كلمة المرور صالحًا. اطلب رابطًا جديدًا.|यह पासवर्ड रीसेट लिंक अब मान्य नहीं है। नया लिंक माँगें।|یہ پاس ورڈ ری سیٹ لنک اب قابلِ استعمال نہیں۔ نیا لنک طلب کریں۔
Containers|Contenitori|Единицы тары|العبوات|बोतलें और डिब्बे|بوتلیں اور ڈبے
You pay|Paghi|Вы платите|تدفع|आप देते हैं|آپ ادا کرتے ہیں
You receive|Ricevi|Вы получаете|تستلم|आपको मिलता है|آپ کو ملتا ہے
You earn|Guadagni|Вы получаете|تربح|आप कमाते हैं|آپ کماتے ہیں
Taker earns|Guadagno del raccoglitore|Доход сборщика|ربح الجامع|इकट्ठा करने वाले की कमाई|جمع کرنے والے کی کمائی
Deposit value|Valore della cauzione|Залоговая стоимость|قيمة الوديعة|जमा राशि|جمع شدہ رقم کی قدر
Unread messages|Messaggi non letti|Непрочитанные сообщения|رسائل غير مقروءة|अपठित संदेश|بغیر پڑھے پیغامات
Type your message…|Scrivi un messaggio…|Введите сообщение…|اكتب رسالتك…|अपना संदेश लिखें…|اپنا پیغام لکھیں…
Confirmed|Confermato|Подтверждено|مؤكّد|पुष्टि हुई|تصدیق شدہ
Bag|Sacco|Пакет|كيس|थैला|تھیلا
Bags|Sacchi|Пакеты|أكياس|थैले|تھیلے
Cash|Contanti|Наличными|نقدًا|नकद|نقد
As agreed|Come concordato|По договорённости|حسب الاتفاق|तय तरीके से|طے شدہ طریقے سے
Collecting|Da ritirare|К вывозу|ما سيتم استلامه|इकट्ठा करना है|جمع کرنا ہے
Pay the giver|Paga il donatore|Оплатите дарителю|ادفع للمعطي|देने वाले को भुगतान करें|دینے والے کو ادائیگی کریں
Address unavailable|Indirizzo non disponibile|Адрес недоступен|العنوان غير متاح|पता उपलब्ध नहीं|پتہ دستیاب نہیں
Manage pickup|Gestisci ritiro|Управлять вывозом|أدر الاستلام|पिकअप प्रबंधित करें|پک اپ کا انتظام کریں
Pickup chat unavailable|Chat del ritiro non disponibile|Чат вывоза недоступен|محادثة الاستلام غير متاحة|पिकअप चैट उपलब्ध नहीं|پک اپ چیٹ دستیاب نہیں
Back to chat|Torna alla chat|Назад в чат|العودة إلى المحادثة|चैट पर लौटें|چیٹ پر واپس جائیں
Time to be agreed|Orario da concordare|Время не согласовано|لم يُتفق على الوقت بعد|समय तय होना बाकी है|وقت طے ہونا باقی ہے
Malta time|Ora di Malta|Время Мальты|توقيت مالطا|माल्टा का समय|مالٹا کا وقت
`.trim();

const columns: Record<Exclude<Locale, 'en'>, number> = { it: 1, ru: 2, ar: 3, hi: 4, ur: 5 };
const dictionary = new Map(entries.split('\n').filter(Boolean).map((line) => {
  const row = line.split('|');
  return [row[0], row] as const;
}));

export function translate(locale: Locale, text: string): string {
  if (locale === 'en') return text;
  return dictionary.get(text)?.[columns[locale]] || text;
}
