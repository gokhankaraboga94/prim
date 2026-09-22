# ÖNEMLİ — Instagram Reels Uçtan Uca Derin Analiz
# wargame.lol / @wargame2028 Keşfet mimarisi için saha belgesi
# Kaynaklar: Meta resmi belgeler, WCAG 2.1, görsel dikkat literatürü,
# 2024–2026 Reels operatör raporları, mute-first UX, skip-rate mimarisi.
# Bu dosya üretim talimatıdır. Tahmin değil, ölçülebilir kural setidir.

---

## 0. Belgenin amacı

Bu belge Reels’in “daha çok izlenmesi” için tek bir sihirli cümle aramaz.
Reels izlenme hacmi üç kapıdan geçer: skip, hold, amplify.
Skip kapısı kapanmadan hold kapısı açılmaz.
Hold kapısı kapanmadan amplify (paylaş / kaydet / profil) kapısı açılmaz.
Bu yüzden belge önce kapı mimarisini, sonra kancayı, sonra rengi,
sonra yazıyı, sonra süreyi, sonra sesi, sonra paylaşımı, sonra
wargame’e özel uygulamayı sırayla işler.

Hedef kitle bu projenin kendi ölçümüyle sabittir:
Türkçe Keşfet, 9:16 dikey, 15–30 saniye kova, savaş oyunu vaadi,
isim tarama / isim çekilişi / kuşatma görseli.
Önceki varyantların (xxx, xxx1–4, vv1, vv2, harika) ortak sonucu
yüzde 55–65 ilk-3-saniye skip’tir. Bu belge o oranı düşürmek içindir.

Aşağıdaki her kural, “güzel görünsün” için değil,
“parmak kaymasın” için yazılmıştır.

---

## 1. Algoritma gerçekten neyi ödüllendirir

Instagram Reels dağıtımı tek bir “viral skoru” değildir.
Meta’nın kendi açıklamalarına ve 2024–2026 operatör raporlarına göre
dağıtım kademelidir.

Birinci kademe: çok küçük bir seed kitleye gösterim.
Bu kitle çoğu zaman hesabın son etkileşim çevresinden ve
benzer içerik izleyen soğuk izleyicilerden karışır.
Bu kademenin tek sorusu şudur: ilk 3 saniyede kaç kişi kaydırdı.

İkinci kademe: seed’de skip düşükse, daha geniş bir soğuk kitle.
Bu kademenin sorusu: ortalama izlenme oranı ve yeniden izleme.

Üçüncü kademe: paylaşım, kaydetme, profil ziyareti, yorum.
Bu kademe “keşfet patlaması”dır. Birinci kademeyi geçmeden gelmez.

Sonuç: 10.000 izlenme isteyen biri aslında 10.000 izlenme istemez.
Önce 200 kişilik seed’de skip’i düşürmek ister.
Seed’de skip yüzde 60 ise algoritma videoyu öldürür.
Seed’de skip yüzde 25–30 ise videoyu büyütür.

Bu yüzden “daha çok izlenme”nin birinci formülü şudur:
izlenme = seed × (1 − skip) × hold × amplify
Hold ve amplify, skip sıfırlanmadan çarpımsal olarak işe yaramaz.

Wargame varyantlarında görülen yüzde 55–65 skip,
videonun “kötü” olduğu anlamına gelmez.
Videonun birinci kademeyi geçemediği anlamına gelir.
Kamera, ordu, mancınık, isim atlası ikinci kademe varlıklarıdır.
Birinci kademe varlıkları yalnızca şunlardır:
ilk kare, ilk 1.5 saniye metin, ilk 3 saniye hareket iddiası.

---

## 2. Skip neden bir kapıdır, bir metrik değildir

Skip oranı “kaç kişi izlemedi” diye okunmamalıdır.
Skip oranı “algoritma bu videoyu ölü kabul etti mi” diye okunmalıdır.

Operatör raporlarında tekrarlanan pratik eşikler:

Skip yüzde 55 ve üstü: video Keşfet’te ölür.
Skip yüzde 40–50: sınırda, bazen niş kitlede yaşar.
Skip yüzde 30 altı: ikinci kademeye geçer.
Skip yüzde 20 altı: üçüncü kademe adayıdır.

Bu eşikler resmi Meta tablosu değildir.
Ama bağımsız Reels analitik araçlarının 2024–2026 özetlerinde
aynı bantlar defalarca görünür.

Kritik nokta: skip, videonun ortasındaki bir sahneden değil,
ilk 1–3 saniyedeki vaatten doğar.
Orta sahnede “daha güzel ordu” skip’i düşürmez.
Orta sahnede daha fazla mancınık skip’i düşürmez.
Skip, izleyicinin beyninin “bu benim için mi?” sorusuna
verilen görsel cevaptır.

Bu cevap yazı ile de verilebilir, hareket ile de.
Ama her iki kanal da sessiz izlemede çalışmak zorundadır.
Çünkü Instagram’da Reels’in büyük çoğunluğu sessiz açılır.

---

## 3. Sessiz izleme gerçeği (mute-first)

2024–2026 tüketici davranış özetlerinde Reels ve kısa video
izlemesinin yüzde 80’inden fazlası sessiz başlar.
Bazı raporlar yüzde 85–90’a kadar çıkar.

Bu, sesin önemsiz olduğu anlamına gelmez.
Bu, sesin birinci kademede yok sayıldığı anlamına gelir.
Birinci kademe görseldir.

Sessiz izlemede çalışan şeyler:
büyük, yüksek kontrastlı metin;
anında okunan 3–7 kelime;
hareketli bir özne (ordu, isim, kilit, dönüş);
yüz / bakış / okunabilir bir işaret.

Sessiz izlemede ölen şeyler:
sese bağlı punchline;
müzikle gelen “vibe”;
küçük altyazı;
konuşarak açıklanan kanca;
ilk 2 saniyede boş manzara.

Wargame için sonuç nettir:
kanca yazısı videonun içine gömülmek zorundadır.
Harici PNG overlay, izleyici telefonunda kırpılabilir,
güvenli alanın dışına düşebilir, ya da hiç eklenmeyebilir.
xxx’in “kullanıcı kendi PNG’sini koyar” modeli
birinci kademeyi şansa bırakır.
harika2’nin kancayı HUD olarak basması doğru yöndür.

Ayrıca Instagram’ın kendi “captions” / otomatik altyazı katmanı
güvenli alanın altına biner.
Bu yüzden kanca asla alt üçüncüde durmamalıdır.
Kanca üst üçte birdedir. Aşağıda ayrı bölümde işlenir.

---

## 4. Süre kovaları ve 15–30 saniye gerçeği

Reels analitik araçlarının tekrarladığı kova yapısı:

0–7 saniye: neredeyse her zaman yüksek skip.
Bu kova “story sticker” gibi tüketilir, reel gibi değil.

8–14 saniye: biraz daha iyi, ama hold için kısa.
Punchline yetişmez, paylaşım gerekçesi oluşmaz.

15–30 saniye: en yüksek ortalama izlenme yüzdesi kovası.
Birçok 2025–2026 özetinde bu kova “yüzde 45 civarı ortalama
izlenme” ile anılır. Yani izleyici videonun yaklaşık yarısını
görür. Bu, algoritma için güçlü bir hold sinyalidir.

31–60 saniye: ancak hikâye gerçekten taşırsa çalışır.
Savaş klibinde 45 saniye, izleyiciyi yorar.
İsim tarama oyunu 45 saniyede boğulur.

60+ saniye: eğitim, vlog, uzun tutorial.
Keşfet soğuk izleyicisi için varsayılan ölüm bölgesidir.

harika2 18 saniyedir. Bu, 15–30 kovasının içindedir. Doğrudur.
spin 13 saniyedir. Bu, 8–14 kovasına yakındır. Sınırdadır.
spin’i 15 saniyeye çekmek, kilit anını koruyarak,
hold metriğini kovaya oturtur. Ama 13 saniye de ölü değildir;
çünkü spin’in vaadi “kim kazanacak”tır ve bu vaat kısa tutulabilir.

Kural: süre, hikâyenin nefesine göre seçilir, tersi değil.
15 saniyelik boş video, 18 saniyelik dolu videodan kötüdür.
Ama 40 saniyelik dolu video da Keşfet soğuk izleyicisinde
15–30 kovasının dışına çıkar.

---

## 5. Hook / kanca nedir — ve ne değildir

Kanca bir slogan değildir.
Kanca, izleyicinin kaydırma refleksini 1.5 saniye erteleyen
görsel-metinsel vaattir.

Kanca üç katmandan oluşur:

Katman A — görsel kanca (0.00–0.40 saniye).
Beyin henüz yazı okumaz. Sadece “bu ne?” diye bakar.
Bu katmanda çalışan şeyler: yüksek doygunluk, büyük şekil,
beklenmedik kompozisyon, hareket halindeki kitle,
keskin ışık-gölge, tek bir baskın renk adası.

Katman B — okuma kancası (0.40–1.50 saniye).
Fovea yazıya kilitlenir. 3–7 kelime taranır.
Bu katmanda çalışan şeyler: sans-serif black weight,
yüksek kontrast, kısa satır, tek vaat.

Katman C — gerekçe kancası (1.50–4.00 saniye).
Beyin “tamam gördüm” der ve kaydırmaya döner.
Bu anda ya yeni bir görsel değişim olur,
ya da yazı tam cümleye büyür ve eylem ister.
4. saniyeden sonra yazı kaybolmalıdır.
Çünkü yazı artık bilgi değil, gürültüdür.
Görsel sahne yazının yerini almak zorundadır.

Kanca olmayan şeyler:

“Merhaba, bugün size şunu göstereceğim.”
Logo + marka animasyonu.
Sisli manzara, sonra yavaşça yazı.
4 kesme / 3 saniye montaj (vv1’in sucu).
Komutan yakın planı.
Yay-ok ses efekti.
Beyaz reklam kartı.
Kırmızı ünlem yığını.
İzleyiciyi aşağılayan “kaydırma, kaybedersin” dili.

Kanca, izleyiciye hakaret etmez.
Kanca, izleyiciye bir oyun verir.

---

## 6. İlk kare doktrini (first-frame)

İlk kare, videonun afişidir.
Keşfet ızgarasında ve akış önizlemesinde bazen
bu kare statik thumbnail gibi de kullanılır.

İlk kare kuralları:

Yazı varsa, yazı ilk karede okunur olmalıdır.
Yazı yoksa, görsel tek bakışta “savaş / ordu / çekiliş”
anlamını taşımalıdır.

İlk karede yüz varsa, yüz kameraya bakmalıdır.
İlk karede kalabalık varsa, kalabalık bir desen oluşturmalıdır.
İlk karede boş gökyüzü varsa, video ölüdür.

wargame harika2 için ilk kare:
yüksek ve uzak 3/4 kamera,
kare ordu deseni,
kapalı kale kapısı,
6 dönem mancınığı,
üst bantta altın-sarı kanca adası,
mat siyah yazı.

Bu kompozisyon “oyuna gir” demez.
Bu kompozisyon “ordu zaten duruyor, sen kaçırıyorsun” der.
In Media Res budur: sahne başlamış gibi görünür.

İlk karede yapılmaması gerekenler:

Kameranın yerden yavaşça yükselmesi.
Siyah fade-in.
Logo splash.
“wargame.lol” filigranının kancanın yerini alması.
İsimlerin henüz okunamayacak kadar küçük olması
(isim tarama vaadi varsa isimler okunmalıdır;
ama kanca yazısından küçük kalmalıdır).

---

## 7. In Media Res — ortasından başla

Reels kancasının en tekrarlanan senaryo kuralı:
videoyu başından değil, ortasından başlat.

Film teorisinde In Media Res, hikâyeyi kriz anında açmaktır.
Reels’te kriz anı “ordu yürüyor / isimler dönüyor / kilit geliyor”
anıdır. Kriz anı “hoş geldiniz” değildir.

Uygulama:

Yanlış: sis, sonra kale, sonra ordu, sonra yazı, sonra eylem.
Doğru: ordu zaten dizili, yazı zaten duruyor, kamera zaten kilitli.

Yanlış: “bugün isim taraması yapacağız.”
Doğru: “ADINI BUL” ve tarama ışığı şimdi hareket ediyor.

Yanlış: rulet yavaş yavaş doluyor.
Doğru: isimler zaten kayıyor, 6. saniyede kilit.

In Media Res, izleyiciye “geç kaldın” hissi verir.
Bu his, kaydırma refleksini kırar.
Çünkü beyin tamamlanmamış bir deseni tamamlama eğilimindedir
(Zeigarnik etkisi). Yarım ordu, yarım çekiliş, yarım cümle
beyni 1–2 saniye daha tutar.

Ama In Media Res, kaosu demek değildir.
Kaos skip üretir. In Media Res, net bir yarım-vaattir.

---

## 8. Pattern interrupt — her 2–3 saniyede bir

Beyin Reels’te “aynı şey devam ediyor” dedigi anda kaydırır.
Bu, yaklaşık 2–3 saniyede bir olur.
Bu yüzden kancadan sonra her 2–3 saniyede
görsel bir değişim gerekir.

Pattern interrupt nedir:
kamera açısı değişimi,
yeni bir nesnenin sahneye girişi,
renk sıcaklığı kayması,
metnin kaybolup görselin büyümesi,
isimlerin kilitlenmesi,
bir birliğin hareketi,
ışık patlaması,
ölçek değişimi (uzak → biraz daha yakın, asla jump-scare değil).

Pattern interrupt ne değildir:
3 saniyede 4 hard cut.
Flash montaj.
Strobe.
Her karede kamera sarsıntısı.
Anlamsız zoom.

vv1’in sucu tam buradadır.
4 kesme / 3 saniye, izleyiciye “reklam montajı” sinyali verir.
Reklam sinyali, reaktans üretir: beyin “beni ikna etmeye çalışıyorlar”
der ve kaydırır. Yüzde 65 skip bu yüzden doğar.

Doğru ritim harika2 için:

0.0–1.5  tarama yazısı (3 kelime), kamera kilitli, ordu duruyor.
1.5–4.0  tam kanca cümlesi, hâlâ aynı kamera, yazı büyür.
4.0      yazı kaybolur. Görsel sahne teslim alınır.
4.0–7.0  ilk interrupt: hafif kamera kayması veya birlik hareketi.
7.0–10.0 ikinci interrupt: mancınık / kapı / rüzgâr / isim vurgusu.
10.0–14  üçüncü interrupt: ölçek veya yön değişimi.
14.0–18  kapanış vaadi: site / isim / sonuç. Yazısız veya tek kelime.

Bu ritim “kesme yağmuru” değildir.
Bu ritim “aynı sahne, yeni bilgi”dir.

---

## 9. Üst üçte bir, ilk fiksasyon bandı

Göz izleme (eye-tracking) çalışmalarında dikey videoda
ilk fiksasyon çoğu zaman üst-orta banttadır.
Telefonu tutan el altı kaplar.
Instagram UI (beğen, yorum, paylaş, ses) sağ alttadır.
Açıklama ve müzik solda / altta biner.
Otomatik altyazı alt banttadır.

Bu yüzden kanca yazısının tek güvenli evi:
çerçevenin üst üçte biri,
sağ ve sol marjı boş,
Instagram’ın 2025 “safe zone” çizgilerinin içinde.

Pratik piksel kuralı (1080×1920):

Üst 180–220 px: status / hesap adı / ses ikonu. Yazı koyma.
Üst 220–640 px: kanca adası. Burası evdir.
Orta 640–1280 px: görsel sahne. Ordu, kale, isimler.
Alt 1280–1920 px: UI + altyazı + açıklama. Kalıcı yazı koyma.

Kanca sağa veya sola yapışmamalıdır.
Kanca tam genişlikte şerit olmamalıdır.
Kanca, kompakt bir “ada” olmalıdır:
arkasında opak zemin, etrafında nefes, içinde 2–3 satır.

Neden ada, neden tam-genişlik şerit değil:
tam-genişlik şerit reklam banner’ı gibi görünür.
Reklam banner’ı reaktans üretir.
Kompakt ada, sahnenin bir parçası gibi durur.

---

## 10. 3–7 kelime kuralı ve tarama evresi

Okuma hızı ve foveal tarama birlikte şunu söyler:
1.5 saniyede ortalama izleyici 3–7 kelime tarar.
7 kelimeden sonrası 1.5 saniyede bitmez.
Bitmeyen yazı, okunmamış yazıdır.
Okunmamış yazı, kanca değildir, duvardır.

Bu yüzden kanca iki evrelidir:

Evre 1 (0.0–1.5 saniye): 3 kelime.
Örnek yapı: EYLEM + NESNE + ZAMAN
veya SORU + ZAMİR + FİİL
veya TEHDİT + SEN + ŞİMDİ

Evre 2 (1.5–4.0 saniye): en fazla 7 kelime, 3 satır.
Evre 1’in açılımıdır, yeni bir konu değildir.
4. saniyede yazı gider.

Yanlış evre 1:
“Wargame.lol’de adını bul ve savaşa katıl hemen”
Bu 9–10 kelimedir. 1.5 saniyede ölür.

Daha doğru evre 1:
“ADINI BUL”
üç kelime, üç vuruş, tek vaat.

Daha doğru evre 2:
“ADINI BUL
SAVAŞA GİR
wargame.lol”
üç satır, her satır 2–3 kelime, toplam 7 civarı.

Ünlem kullanılmaz.
Ünlem, bağıran reklam işaretidir.
Keşfet soğuk izleyicisi bağırana kaydırır.

İsimlerin üzerine @ konmaz.
@, sosyal kullanıcı adı işaretidir, ordu ismi değildir.
@, yazıyı kalabalıklaştırır ve OCR/okuma hızını düşürür.

---

## 11. Tipografi — font, ağırlık, polarite

Görsel dikkat literatürü ve WCAG birlikte okunursa
Reels kancası için tipografi kuralları netleşir.

Font ailesi: grotesk sans-serif.
Inter, Helvetica, Arial, SF Pro.
Serif (Times, Georgia) küçük punto ve hareketli zeminde erir.
El yazısı / script Reels kancasında okunmaz.
Condensed font ancak tek kelimede ve çok büyük puntoda olur.
Outfit 900 projede yüklenmediği için ölüdür.
Yüklenmeyen font, sistem varsayılanına düşer.
Sistem varsayılanı her telefonda farklıdır.
Bu yüzden Inter Black 900 gibi gerçekten yüklenen bir kesit
tek doğru seçenektir.

Ağırlık: 800–900.
Regular 400 Reels kancasında görünmez.
Medium 500 “açıklama yazısı”dır, kanca değildir.
Bold 700 alt sınırdır.
Black 900 kanca ağırlığıdır.

Harf aralığı: biraz sıkı, ama çarpışmayacak kadar.
Çok geniş tracking, 1.5 saniyelik taramayı yavaşlatır.
Çok sıkı tracking, özellikle I / İ / l çarpışması yapar.
Türkçe İ/ı/ğ/ş/ö/ü glifleri fontta gerçekten olmak zorundadır.
Inter bu glifleri taşır. Sahte-bold (stroke ile kalınlaştırma)
glifleri bozar. Sahte-bold yasaktır.

Punto: kanca, çerçevenin kısa kenarının yüzde 7–11’i.
1080 genişlikte bu kabaca 75–120 px’dir.
Daha küçük yazı “var” ama “okunmaz”.
Daha büyük yazı sahneyi yer, reklam olur.

Satır sayısı: tarama evresinde 2, tam kancada 3.
4 satır Reels kancasında ölür.

Hizalama: ada içinde sola veya ortaya.
Tam genişlik justify yasaktır.
Satır sonu heceleme yasaktır.
Her satır kendi başına bir vuruş olmalıdır.

---

## 12. Polarite: açık zemin + koyu yazı

Pozitif polarite: koyu yazı, açık zemin.
Negatif polarite: açık yazı, koyu zemin.

Reklam ve kısa promosyon literatüründe
pozitif polarite, kısa mesajda daha hızlı taranır.
Gündüz ışığında, parlak telefonlarda, dış mekânda
pozitif polarite pupil’i daraltır, keskinliği artırır.
Negatif polarite (beyaz yazı siyah şerit) gece ve sinema
estetiği taşır ama Keşfet soğuk izleyicisinde
“altyazı / kredi / netflix kapağı” gibi durabilir.

wargame sahnesi zaten koyu (gece gökyüzü, kale taşı, zırh).
Koyu sahnenin üstüne koyu şerit + açık yazı koymak
yazıyı sahneye gömer. Kontrast kaçar.
Açık (altın-sarı) ada + mat siyah yazı,
sahneye karşı pop-out üretir.

Bu, “her zaman sarı kullan” demek değildir.
Bu, “koyu sahneye karşı açık ada kullan” demektir.
Sahne açık olsaydı (gündüz çöl, kar) tersi gerekirdi.

Pupil notu:
parlak ada pupil’i biraz kısar, yazı kenarları keskinleşir.
Koyu ada pupil’i açar, yazı kenarları yumuşar,
özellikle hareketli zeminde.
Kanca 1.5 saniyede keskin olmak zorundadır.
Bu yüzden harika2’de altın ada + siyah mürekkep doğrudur.

---

## 13. WCAG kontrastı — 4.5:1 minimum, 7:1 hedef

WCAG 2.1 Contrast Minimum (1.4.3):
normal metin için 4.5:1, büyük metin için 3:1.

WCAG 2.1 Contrast Enhanced (1.4.6):
normal metin için 7:1, büyük metin için 4.5:1.

Reels kancası “büyük metin”dir (18pt+ ve bold).
Ama telefon, sıkıştırma, hareket, gökyüzü sızıntısı
kontrastı yerinde düşürür.
Bu yüzden kanca için hedef 7:1 olmalıdır, 3:1 değil.

Yarı saydam koyu plaka bu yüzden ölüdür.
Gökyüzü plakadan sızar, kontrast 7:1’in altına iner,
yazı “var gibi” durur, okunmaz.
Opak zemin zorunludur.

Altın-sarı #ffd54f üzerine mat siyah #111111
yaklaşık olarak 10:1 civarı bir kontrast üretir
(kesin oran render gamma’sına göre değişir).
Bu, 7:1 hedefinin üzerindedir. Doğrudur.

Beyaz #ffffff üzerine sarı #ffd54f çalışmaz.
Sarı-beyaz kontrastı düşüktür, yazı erir.

Kırmızı #ff0000 üzerine siyah çalışır ama
kırmızı, Keşfet’te “uyarı / indirim / clickbait”
anlamına da gelir. Reaktans riski taşır.
Kırmızı, vurgu rengi olarak bir kelimede kalabilir.
Kırmızı, tüm adanın rengi olmamalıdır.

---

## 14. Renk psikolojisi — kırmızı, sarı, siyah

Renk, estetik tercih değildir.
Renk, dikkat ekonomisidir.

Sarı:
periferik görüşte en erken yakalanan renklerden biridir.
Trafik uyarıları, taksi, okul otobüsü bu yüzden sarıdır.
Sarı, “bak buraya” der, “satın al” demez.
Altın-sarı (#ffd54f) saf sarıdan (#ffff00) daha az bağırır,
daha az “ucuz indirim” taşır, daha çok “madalya / ganimet”
taşır. Savaş oyunu için doğrudur.

Kırmızı:
amygdala ve tehdit/uyarı sistemiyle ilişkilendirilir.
Dikkat çeker, ama “tehlike / yasak / kan” da çeker.
Kırmızı kanca, 0.3 saniyede bakış toplar.
Ama 1.5 saniyede “reklam” yargısına da kayabilir.
Önceki kırmızı-kalın kanca denemesi bu yüzden risklidir.
Kırmızı, kancanın tamamı olmamalı, vurgu olmalıdır.

Siyah:
otorite, zemin, okunabilirlik.
Mat siyah (#111111) saf siyahtan (#000000) daha az “delik”
görünür, sıkıştırmada banding yapmaz.
Yazı rengi olarak siyah, altın zemin üzerinde kraldır.

Beyaz:
temizlik, boşluk, modern SaaS.
Savaş sahnesinde beyaz ada “PowerPoint slayt” olur.
Önceki beyaz reklam kartı reaktans üretmiştir.
Beyaz, isim listesinde (spin) doğrudur,
çünkü spin’in zemini siyahtır.

Mavi:
güven, sakinlik, kurumsal.
Savaş kancasında mavi “bak buraya” demez.
Mavi, arka plan gökyüzü olarak kalabilir.
Yazı rengi olarak mavi, altın zemin üzerinde zayıftır.

Yeşil:
izin, sağlık, para.
Kanca rengi değildir. Kazanan isim vurgusunda
çok düşük doygunlukta kullanılabilir.

---

## 15. Chromostereopsis — kırmızı-mavi yasağı

Chromostereopsis, kırmızı ve mavinin aynı düzlemde
farklı derinliklerde algılanmasıdır.
Kırmızı öne fırlar, mavi geri kaçar.
Sonuç: titreme, göz yorgunluğu, “ucuz 3D”.

Reels kancasında kırmızı yazı + mavi gökyüzü
veya kırmızı ada + mavi kenarlık yasaktır.
Sarı ada, mavi gökyüzüne karşı da derinlik farkı üretir
ama chromostereopsis kadar saldırgan değildir.
Sarı, spektrumun ortasına yakındır.

Kenarlık kullanılacaksa:
ada kenarı siyah veya koyu kahverengi olmalıdır.
Mavi, mor, cyan kenarlık yasaktır.
Kırmızı kenarlık, sarı ada üzerinde “uyarı kutusu” olur.
Kullanılmamalıdır.

Gölge (drop shadow) kullanılacaksa:
gölge, yazıyı okunur kılmak için değil,
adayı sahneden ayırmak için, çok yumuşak ve kısa olmalıdır.
Sert kırmızı gölge, chromostereopsis’in kuzenidir.

---

## 16. Pop-out ve bottom-up dikkat

Görsel dikkat iki yoldan çalışır:

Bottom-up (aşağıdan yukarı):
sahne, beyne “buraya bak” der.
Renk farkı, parlaklık farkı, hareket, yön.
Bu yol istemsizdir. 100–300 ms içinde çalışır.
Reels kancasının birinci silahı budur.

Top-down (yukarıdan aşağı):
izleyici “adımı arıyorum” diye bakar.
Bu yol istemlidir. İsim tarama oyununda devreye girer.
Ama soğuk Keşfet izleyicisi henüz “adımı arıyorum”
dememiştir. Önce bottom-up onu durdurmalıdır.

Pop-out, bottom-up’ın en temiz halidir:
tek bir özellik (renk, yön, boyut) kalabalıktan ayrılır.
Altın ada, koyu sahnenin içinde tek sarı nesnedir.
Bu, pop-out’tur.

Pop-out’u öldüren şeyler:
sahnede ikinci bir sarı nesne (altın zırh parlaması,
sarı bayrak, sarı yazı filigranı).
Birden fazla kanca rengi.
Hareket eden yazı + hareket eden ordu + hareket eden kamera.
Hepsi birden “bak buraya” derse, hiçbir yere bakılmaz.

Kural: 0–1.5 saniyede tek pop-out hedefi vardır.
O hedef kanca adasıdır.
1.5–4 saniyede hedef hâlâ adadır, ama yazı değişir.
4. saniyeden sonra pop-out hedefi sahneye geçer:
tarama ışığı, kilit, kazanan isim, mancınık.

---

## 17. Hareket ve kamera — ne zaman kilit, ne zaman kay

Kamera, kancanın rakibidir.
Kamera hareket ederse, yazı okunmaz.
Yazı duruyorsa, kamera durmalıdır.

0–4 saniye: kamera kilitli veya neredeyse kilitli.
harika2’nin yüksek-uzak 3/4 kilidi bu yüzden vardır.
Yakın plan yüz, yazıyı yer.
Alçak açı, orduyu kahramanlaştırır ama kanca adasını
göğe karşı daha da yarı saydam yapar.
Yüksek-uzak açı, orduyu desen haline getirir.
Desen, ilk karede “ordu”yu 0.3 saniyede anlatır.

4. saniyeden sonra kamera yavaşça kayabilir.
Kayma, kesme değildir.
Kayma, izleyiciye “sahne canlı” der.
Ani kesme, izleyiciye “reklam kurgusu” der.

Yasaklar:

Yakın dikey bakış (lookAt neredeyse kamera ekseninde).
Bu, vv1 boş blob hatasını doğurmuştur:
Hud kamera varsayılanı çalar, sahne boş kaydeder.

Sarsıntı (handheld shake) kanca evresinde.
Sarsıntı, 4. saniyeden sonra çok düşük genlikte olabilir.

Zoom-in kanca yazısının üzerine.
Yazı zaten HUD’dur, zoom onu bozar.

4K (dpr=2) harika2’de.
4K, ok sayıları + antialias + isim atlası ile birlikte
kare düşürür. Kare düşmesi, skip üretir.
Çünkü video “takılıyor” gibi durur.
harika2 1080p’dir. Bu bir kalite düşüşü değil,
birinci kademe sigortasıdır.

---

## 18. FPS, oklar, antialias — teknik skip

İzleyici takılmayı “sıkıcı video”dan daha hızlı cezalandırır.
Takılan video, parmağa “bu bozuk” der.
Bozuk içerik kaydırılır.

harika2 donmasının kökleri:

Ok parçacıkları (MAX_ARROWS) her karede fizik ve çizim yer.
quiet modu sesi kapatıyordu, okları kapatmıyordu.
nameHunt ok spawn etmeye devam ediyordu.
Bu, freeze’in asıl nedenidir.

dpr=2 (4K eşdeğeri buffer) GPU’yu iki katına çıkarır.
vv2 ve spin bunu kaldırabilir, çünkü sahneleri sade olabilir.
harika2 ordu + kale + 6 mancınık ile kaldıramaz.

antialias, kenarları güzelleştirir, GPU yer.
quiet / harika2’de antialias kapalıdır.

Kayıt tarafı:
MediaRecorder bitrate 4K’da 24 Mbps’e çıkıyordu.
1080p’de daha düşük bitrate yeter.
REEL_HOLD warmup 2.25 saniye kayıt öncesi çalışır.
sampleT = recT olmalıdır.
Warmup, kaydın ilk 2 saniyesini zehirlememelidir.
Zehirlenen ilk 2 saniye, skip’in ta kendisidir.

Teknik kural:
birinci kademe videosu 30 fps kilitli, 1080×1920,
ok yok, antialias yok, warmup kayda sızmaz.
Güzellik ikinci kademenin işidir.

---

## 19. Ses tasarımı — ikinci kademe silahı

Ses, skip’i düşürmez.
Ses, hold’u uzatır ve paylaşımı artırır.

Mute-first dünyada sesin işi:
sesi açan yüzde 10–20’ye ödül vermek.

Ödül nedir:
düşük, tok, dönemsel bir vuruş;
kilit anında tek bir “tok”;
kazanan isimde kısa bir yükselme;
asla yay-ok ıslığı;
asla komutan bağırması;
asla stok “epic trailer” koro.

Ses açılmasa da video anlaşılmalıdır.
Ses açılırsa video daha tatmin edici olmalıdır.
Bu, “sesizde tam, seste zengin” kuralıdır.

Müzik lisansı:
Keşfet, copyright müziği bazen dağıtımı kısar.
Orijinal, kısa, döngüsüz bir yatak daha güvenlidir.
Müzik, kancadan sonra girmelidir.
0. saniyede bas drop, reklam kurgusudur.

---

## 20. Metin overlay vs konuşma

Konuşan kafa (talking head) bazı nişlerde kraldır.
Savaş Keşfet’inde kral değildir.
Soğuk izleyici birinin yüzünü değil, orduyu ister.

Bu yüzden kanca konuşulmaz, yazılır.
Yazı, HUD’dur. HUD, sahnenin üstündedir, içinde değildir.
3D sahneye gömülen yazı (dünya-uzayı billboard)
perspektifle küçülür, okunmaz.
2D HUD yazı, her karede aynı pikselde durur. Doğrudur.

Konuşma kullanılacaksa:
4. saniyeden sonra,
tek cümle,
altyazısı HUD kancasıyla çakışmayan,
alt bantta, Instagram altyazısından yukarıda.

Ama harika2 ve spin konuşmasızdır. Konuşmasız kalmalıdır.
Konuşma, bu iki formatın vaadini kirletir.

---

## 21. İsimler, kimlik, “ben varım” kancası

wargame’in gerçek kancası savaş değildir.
wargame’in gerçek kancası isimdir.

İnsanlar kendi isimlerini, arkadaşlarının isimlerini,
klan isimlerini arar.
Bu, top-down dikkatin yakıtıdır.

Ama soğuk izleyici henüz ismini aramıyordur.
Önce bottom-up (sarı ada, ordu deseni) durdurur.
Sonra yazı “ADINI BUL” der.
Sonra isimler okunacak kadar büyük görünür.
Sonra izleyici kendi ismini aramaya başlar.
Bu an, skip kapısının kapandığı andır.

İsim kuralları:

@ yok.
Özel karakter yığını yok.
Türkçe karakterler doğru.
İsim atlası net, gölgesiz, yüksek kontrast.
İsimler kanca yazısından küçük.
İsimler Instagram UI’sine binmez.
Kare orduda isimler satır düzeninde okunur.
Spin’de isimler siyah zeminde beyazdır.

İsim tarama ışığı:
yavaş, tek yön, tek satır.
Hızlı rastgele zıplama “bozuk slot” gibi durur.
Bozuk slot, güven kırar.

---

## 22. Spin formatı — rulet, kilit, büyüme

Spin, harika2’den ayrı bir hayvandır.
harika2: ordu + kanca + tarama vaadi.
spin: siyah zemin + beyaz isimler + kilit + kazanan.

Spin zaman çizelgesi (mevcut 13s / kilit 6s):

0–6 saniye: isimler karışır, kazanan görünmez.
6. saniye: kilit. Kazanan ilk kez netleşir.
6–13 saniye: kazanan büyür, diğerleri solar.

Bu formatın kancası yazı değil, harekettir.
İlk karede isimler zaten kayıyordur.
Vaadi “kim?” dir.
“Kim?” sorusu Zeigarnik etkisini doğrudan çalıştırır.

Kurallar:

İsim havuzu her kayıtta karışır.
Aynı sıra, “hileli” hissi verir.
Kazanan, kilit anına kadar okunamaz.
Erken sızan kazanan, oyunu öldürür.
Kilit anında tek bir görsel vurgu (büyüme, parlama, çerçeve).
İki vurgu birden kilit anını kirletir.
Siyah zemin, beyaz isim, tek kazanan rengi (altın).
Başka renk yok.

13 saniye sınırdadır.
Kilit 6’da ise, izleyiciye 7 saniye “sonucu sindirme”
payı kalır. Bu pay, paylaşım gerekçesidir.
“Bak ben çıktım / bak o çıktı” klip paylaşımı
bu 7 saniyede doğar.

---

## 23. Paylaşım, kaydetme, profil — üçüncü kademe

Algoritma üçüncü kademede şunları sayar:

Paylaşım (DM + story + dışarı).
Kaydetme.
Profil ziyareti.
Takip.
Yorum.
Yeniden izleme (rewatch).
Beğeni (en zayıfı).

Beğeni, ego okşar, dağıtımı az büyütür.
Kaydetme, “bunu sonra kullanacağım” demektir.
Paylaşım, “bunu başkası da görsün” demektir.
Profil ziyareti, “bu hesap nedir” demektir.

wargame için üçüncü kademe yakıtı:

İsim. İnsan kendi ismini paylaşır.
Çekiliş. İnsan kazananı arkadaş grubuna atar.
Ordu deseni. İnsan “ben şuradayım” diye story atar.
Site adı. Profil / bio / yazı ile tek yerde durur.

Videoya “takip et” yazmak üçüncü kademeyi zorlamaz.
Takip, vaat tutulduktan sonra gelir.
Vaat: adını gördün, savaşı gördün, kazananı gördün.
CTA: wargame.lol — tek yerde, 4. saniyeden sonra,
küçük, altın adasız, sahnenin bir parçası olarak.

Yorum tuzağı (“adını yaz”) bazen çalışır.
Ama Keşfet soğuk izleyicisi yorum yazmadan kaydırır.
Yorum tuzağı ikinci kademe taktiktir, birinci değil.
Birinci kademeye “yorumlara adını bırak” yazmak
3–7 kelime kotasını yakar.

---

## 24. Açıklama, hashtag, kapak, yayın saati

Açıklama, skip’i düşürmez.
Açıklama, üçüncü kademede arama ve profil bağlamı verir.

Açıklama kuralı:
ilk satır, vaadin tekrarıdır, hikâye değil.
3–8 kelime.
Sonra boş satır.
Sonra 3–5 niş hashtag, 20 tane değil.
Hashtag yağmuru 2022 taktiğidir, 2026’da zayıf sinyaldir.

Kapak (cover):
Reels ızgarasında bazen ilk kare, bazen seçilen kare.
Kapak, kanca adasını içermelidir.
Ordu deseni okunmalıdır.
Yüz / komutan kapağı bu projede yasaktır.

Yayın saati:
Türkiye için akşam 19–23 ve öğle 12–14 sık anılır.
Ama saat, skip’i düzeltmez.
Kötü kanca, prime time’da da ölür.
İyi kanca, öğleden sonra da büyür.
Saat, üçüncü kademe ince ayarıdır.

Sıklık:
günde 1–3 Reels, aynı kanca iskeleti, farklı isim havuzu.
Algoritma hesabı “tutarlı format” ile tanır.
Her videoda yeni format, her seferinde seed’i sıfırlar.

---

## 25. Güvenli alanlar — 2025–2026 UI

Instagram UI sık değişir.
Ama 2025–2026 dikey Reels’te sabitler şunlardır:

Sağ alt: beğen, yorum, paylaş, kaydet, ses.
Sol alt: ses adı / orijinal ses.
Üst: hesap, müzik, kapat.
Alt orta: açıklama, takip, daha fazla.

Kanca bu bölgelere binmemelidir.
CTA bu bölgelere binmemelidir.
İsimler sağ alt sütuna binmemelidir.
Filigran sağ alta konmamalıdır — zaten UI oradadır.

Önerilen HUD haritası (1080×1920):

Kanca adası: x merkez, y = 260–520.
Ordu / sahne: y = 520–1400.
Spin isimleri: y = 400–1500, sağ marj 160 px boş.
Kazanan büyüme: merkez, UI’den uzak.
Site CTA (varsa, 14. saniyeden sonra): y ≈ 1100, küçük.

Bu harita “güzel kompozisyon” için değil,
parmak ve UI için çizilmiştir.

---

## 26. Sıkıştırma, codec, renk kaybı

Instagram videoyu yeniden kodlar.
H.264, orta bitrate, 4:2:0 chroma.
İnce renkler, özellikle koyu mavi ve koyu kırmızı, erir.
İnce yazı stroke’ları kaybolur.
Düşük kontrast plakalar çamur olur.

Üretim kuralları:

Yazı stroke’u 2 px “incelik” olmasın.
Ya opak ada, ya kalın yazı. İkisi birden değil, ada yeter.

Sarı #ffd54f, sıkıştırmada #ffd54f’ye yakın kalır.
Çünkü doygunluk yüksek, parlaklık orta.
Çok koyu altın (#b8860b) sıkıştırmada kahverengi çamura döner.

Siyah #111111, #000000’dan daha az banding yapar.
Saf siyah, H.264 macroblock’larında “delik” gibi durur.

1080×1920, 30 fps, yüksek bitrate kayıt, tek geçiş.
4K yüklemek, Instagram’ın 1080’e düşürmesiyle
çift sıkıştırma üretir. Çift sıkıştırma yazıyı yer.

---

## 27. Test protokolü — nasıl bileceğiz işe yaradı

Bir kanca “güzel” diye tutulmaz.
Bir kanca skip ile tutulur.

Protokol:

Aynı günde, aynı saatte, aynı açıklama iskeletiyle
yalnızca kanca evresi değişen 2 varyant yayınlanır.
Ölçülen tek metrik ilk 3 saniye skip / average watch.
Beğeni bakılmaz. Yorum bakılmaz. İlk 2 saat bakılmaz.
24 saat sonra skip okunur.

Başarı eşiği:
skip yüzde 55–65 → başarısız, varyant ölür.
skip yüzde 40–50 → sınır, yalnızca isim havuzu değişerek bir kez daha.
skip yüzde 30 altı → iskelet kilitlenir, bundan sonra yalnızca
isim / ordu / spin içeriği değişir, kanca iskeleti değişmez.

Aynı anda 5 şey değiştirmek testi öldürür.
Kamera + yazı + renk + süre + ses birden değişirse
hangi değişkenin işe yaradığı bilinmez.

harika2 iskeleti kilitlenene kadar
yalnızca şu değişkenler sırayla test edilir:
1) evre 1 kelimeleri
2) ada rengi (sarı vs kırmızı vs beyaz — beyaz zaten öldü)
3) kamera yükseklik
4) yazının 4. saniyede kaybolması (zaten kural)
5) 18s vs 15s

Spin için ayrı protokol:
kilit saniyesi 5 / 6 / 7.
süre 13 / 15 / 18.
isim hızı.

---

## 28. Önceki varyantların otopsisi

xxx:
kanca yok, kullanıcı PNG koyacak.
Birinci kademe şansa bırakılmış.
Skip yüksek olması beklenen sonuçtur.

xxx3:
şahin dalışı opener.
Hareket var, ama yazı ve vaat geç gelir.
In Media Res değil, “giriş sahnesi”dir.
Giriş sahnesi skip üretir.

vv1:
4 hard cut / 3 saniye.
Reklam montajı sinyali.
Hud kamera çalma riski.
Boş blob.
Yüzde 65 skip bu varyantın imzasıdır.

vv2:
retention denemesi, hâlâ kesme ağırlıklı.
4K dpr=2 ile hayatta kalabilir, çünkü sahne sade olabilir.
Kanca mimarisi harika2 kadar net değildir.

harika:
araştırma öncesi kanca.
Beyaz kart / kırmızı kalın / yanlış font denemeleri.
Reaktans + okunaksız polarite.

harika2:
doğru kovada (18s).
doğru kamerada (yüksek-uzak).
doğru polaritede (sarı ada, siyah yazı).
doğru evrede (0–1.5 tarama, 1.5–4 kanca, 4’te sil).
doğru teknikte (1080p, ok yok, AA kapalı).
Hâlâ ölçülecek olan tek şey kelime seçimi ve seed skip’tir.

spin:
doğru vaat (kim?).
doğru zemin (siyah-beyaz).
doğru kilit (6s).
süre kovası sınırda (13s).
Kazananın erken sızmaması kritik kuraldır.

---

## 29. Yasak listesi — bir daha yapılmayacaklar

Komutan yakın planı.
Yay-ok sesi ve ok parçacığı.
Açık kale kapısı + düşman dalgası (vaadi dağıtır).
Beyaz reklam kartı.
Yüklenmeyen font (Outfit 900).
Yarı saydam plaka.
Kırmızı-mavi kenarlık.
Ünlem.
@ işareti isimlerde.
Alt bant kanca.
4 kesme / 3 saniye opener.
Logo splash.
“Merhaba bugün”.
4K harika2.
Antialias + ok + 4K aynı anda.
Warmup’ın kayda sızması.
Hud’un PerspectiveCamera’yı çalması.
Kanca yazısının 4. saniyeden sonra kalması.
CTA’nın kanca kotasını yemesi.
Aynı anda 5 değişken değiştirmek.

Bu liste “zevk” listesi değildir.
Bu liste, ölçülmüş ölüm nedenleridir.

---

## 30. Kelime bankası — evre 1 ve evre 2

Evre 1 (3 kelime, 0–1.5s), savaş/isim nişi:

ADINI BUL
SAVAŞA GİR
ORDUN HAZIR
İSMİN NERDE
KİLİT GELİYOR
KİM KAZANIR

Evre 1 yasakları:
ÜCRETSİZ OYNA (reklam)
HEMEN TIKLA (reklam)
KAÇIRMA (bağırış)
SON ŞANS (yalnış aciliyet)
WARGAME LOL (marka, vaat değil)

Evre 2 (7 kelime / 3 satır, 1.5–4s):

ADINI BUL
SAVAŞA GİR
wargame.lol

ORDUN HAZIR
İSMİNİ ARA
wargame.lol

KİM KAZANIR
KİLİT GELİYOR
isimler dönüyor

Evre 2’den sonra yazı yok.
Site adı evre 2’nin üçüncü satırında durabilir.
14. saniyede tekrar site adı, küçük, adasız, isteğe bağlı.

Ton:
emir kipinde, kısa, Türkçe, küçük harf yok.
Başlık düzeni (ADINI BUL) taramayı hızlandırır.
Cümle düzeni (Adını bul ve savaşa katıl) taramayı yavaşlatır.

Hakaret yok.
“Hâlâ kaydırıyorsan korkaksın” türü kanca,
kısa vadede bakış toplar, uzun vadede hesabı kirletir.
Keşfet soğuk izleyicisi hakareti markaya yazar, videoya değil.

---

## 31. Kadın / erkek, yaş, niş gözü

wargame nişi: strateji, savaş, rekabet, isim, klan.
Bu nişin Keşfet gözü, genel “eğlence” gözünden farklıdır.

Genel eğlence: yüz, dans, punchline, trend ses.
Savaş nişi: düzen, güç, aidiyet, isim, ganimet.

Trend ses kullanmak, nişi genel eğlenceye çeker.
Genel eğlenceye çekilen savaş videosu,
dans izleyicisine düşer ve skip olur.
Bu yüzden trend ses, bu projede varsayılan değildir.

Yaş bandı:
strateji oyunu izleyicisi genelde 16–34.
Bu bant, yazıyı hızla tarar, reklamı hızla cezalandırır.
Bu bant, “ünlem + kırmızı + HEMen” paketini çocuk içeriği
veya dropshipping reklamı sanır.

Cinsiyet:
ordu deseni ve isim tarama, cinsiyetten bağımsız çalışır.
Yüz / komutan / “güzel kadın savaşçı” kancası
nişi kaydırır, skip’i düzeltmez.
Yasak listesindeki “komutan yok” kuralı bu yüzden de vardır.

---

## 32. Rakip tarama — savaş oyunu Reels’lerinde ne ölür

Mobil savaş / strateji reklamlarının klasik ölümü:

Sinema klibi gibi 40 saniye hikâye.
Keşfet soğuk izleyicisi hikâyeyi izlemez, reklamı tanır.

“Binlerce oyuncu savaşıyor” yazısı.
Soyut sayı, kişisel isimden zayıftır.

Gameplay HUD’unun (can barı, mini harita) ilk karede
reklam gibi durması.
harika2 HUD’u oyun HUD’u değildir, kanca adasıdır.
Karıştırılmamalıdır.

Influencer yüzü + “bu oyunu denedim”.
Yüz, oyunu yer. İsim tarama vaadi ölür.

App Store yıldızı, “4.9 rating”.
Keşfet’te güven sinyali değil, reklam sinyali.

Kazanan tarama:
isim + ordu + kısa süre + sessiz anlaşılırlık.
Bu tarama, niş içinde hâlâ az kullanılmaktadır.
Bu, wargame’in gerçek farkıdır.
Farkı öldüren şey, genel Reels taktiklerini (4 kesme, kırmızı
ünlem, trend ses) üzerine yapıştırmaktır.

---

## 33. Uçtan uca üretim hattı

Aşağıdaki hat, her Reels için aynı sırada işler.

1. Vaat seç.
   harika2 vaadi: adını bu orduda bul.
   spin vaadi: bu çekilişte kim kazanır.
   İki vaat bir videoda birleşmez.

2. Süre kovası seç.
   harika2: 18s (15–30).
   spin: 13s, gerekirse 15s.

3. İlk kareyi çiz.
   Kanca adası yerinde, ordu desen, kapı kapalı.
   Thumbnail testi: 200ms bakışta vaat okunuyor mu.

4. Evre 1 yazısını yaz.
   3 kelime. Ünlem yok. Marka yok.

5. Evre 2 yazısını yaz.
   3 satır, ≤7 kelime. 4. saniyede silinir.

6. Kamera kilidi 0–4s.
   Yüksek-uzak 3/4. Hud çalmaz.

7. Pattern interrupt 4–18s, 2–3s aralık.
   Kesme değil, bilgi değişimi.

8. Teknik sigorta.
   1080p, ok yok, AA kapalı, warmup sızmaz, 30 fps.

9. Ses ikinci kademe.
   Kilit / vuruş, trailer koro yok.

10. Kapak = ilk kare.
    Açıklama = vaat tekrarı + 3–5 hashtag.

11. Yayın.
    Aynı iskelet, yeni isim havuzu.

12. 24 saat sonra skip oku.
    Eşik altıysa iskeleti kilitle.
    Eşik üstüyse yalnızca bir değişken değiştir.

Bu hat atlanırsa, “yeni fikir” yalnızca yeni bir ölüm olur.

---

## 34. harika2 kanca iskeleti — kilitlenmiş kararlar

Aşağıdakiler bu belgenin üretim kararıdır.
Yeni araştırma gelmedikçe değiştirilmez.

Zemin: altın-sarı #ffd54f, opak, kompakt ada.
Yazı: mat siyah #111111.
Font: Inter Black 900, gerçekten yüklü.
Evre 1: 0.0–1.5, 2 satır, 3 kelime.
Evre 2: 1.5–4.0, 3 satır, ≤7 kelime.
4.0: yazı yok.
Konum: üst üçte bir, ilk fiksasyon bandı.
Kamera: yüksek-uzak 3/4, 0–18s aynı aile.
Süre: 18s.
Çözünürlük: 1080p.
Ok: yok.
Antialias: kapalı.
Kapı: kapalı.
Düşman: yok.
Komutan: yok.
Ünlem: yok.
@ : yok.
İsimler: kancadan küçük, düz metin.

Kelime varsayılanı (test 1):
Evre 1: ADINI BUL
Evre 2: ADINI BUL / SAVAŞA GİR / wargame.lol

Tek değişkenlik alanı: evre 1–2 kelimeleri.
Renk, polarite, süre, kamera, font kilitlidir.

---

## 35. spin iskeleti — kilitlenmiş kararlar

Zemin: siyah.
İsim: beyaz.
Kazanan: kilit anında altın vurgu + büyüme.
Süre: 13s.
Kilit: 6.0s.
Kazanan 6.0’dan önce okunmaz.
Havuz her kayıtta karışır.
Tekrarlayan sıra yok.
UI sağ alt boş.
Yazı kanca adası yok; vaat harekettir.
Gerekirse evre 1 olarak tek satır “KİM KAZANIR”
0–1.5s, sonra sil. Bu satır isteğe bağlıdır.
Varsayılan: yazısız, çünkü hareket yeter.

Test değişkeni: süre 13 vs 15; kilit 6 vs 7.

---

## 36. Bilimsel dayanak özeti

Bu bölüm, yukarıdaki kuralların “neden”ini tek yerde toplar.

Skip-gate modeli:
kısa videoda dağıtım, erken terk oranına duyarlıdır.
Seed kitlede yüksek skip, genişletmeyi keser.

Mute-first:
kısa video tüketiminin büyük çoğunluğu sessiz başlar.
Görsel vaat, sesten önce gelir.

Foveal tarama:
1.5 saniyede 3–7 kelime.
Daha uzun yazı okunmaz, duvar olur.

Bottom-up pop-out:
tek özellik farkı, istemsiz bakış toplar.
İkinci bir pop-out, birincisini öldürür.

WCAG 1.4.3 / 1.4.6:
4.5:1 minimum, 7:1 hedef.
Yarı saydam zemin bu oranı bozar.

Pozitif polarite:
kısa promosyon mesajında koyu-on-açık daha hızlı taranır.
Koyu sahnede açık ada, sahneye karşı pop-out üretir.

Sarı periferi:
sarı, yan görüşte erken yakalanır, “bak buraya” der.
Altın-sarı, saf sarıdan daha az reklam bağırır.

Kırmızı amygdala:
kırmızı bakış toplar ama uyarı/reklam yargısı da taşır.
Tüm adanın rengi olmamalıdır.

Chromostereopsis:
kırmızı-mavi çiftleri titrer, göz yorar, yasaktır.

Zeigarnik:
tamamlanmamış desen (kim kazanır, adın nerde)
beyni kısa süre daha tutar.
Bu, In Media Res ve spin kilidinin gerekçesidir.

Reaktans:
izleyici “reklam / manipülasyon” hissederse kaydırır.
4 kesme, ünlem, beyaz kart, HEMen TIKLA bu hissi üretir.

Güvenli alan:
telefon eli + Instagram UI alt ve sağ bandı yer.
Kanca üst üçte birdedir.

Süre kovası:
15–30 saniye, birçok raporda en yüksek ortalama
izlenme yüzdesi bandıdır. 18s bu bandın içindedir.

Teknik akıcılık:
donan video, içerikten bağımsız kaydırılır.
Ok, 4K, AA, warmup sızıntısı donma üretir.

---

## 37. Kaynak haritası (araştırma izi)

Bu belge tek bir blog yazısının kopyası değildir.
Aşağıdaki başlıklar, 2024–2026 açık kaynak taramasının
birleşimidir. Rakamlar operatör özetidir, Meta’nın
her hesap için verdiği resmi tablo değildir.

Meta / Instagram resmi:
Reels öneri sisteminin etkileşim ve izlenme tamamlama
sinyallerini kullandığına dair yardım merkezi metinleri.
Otomatik altyazı ve UI yerleşimi.

WCAG 2.1:
Understanding Contrast Minimum (1.4.3).
Understanding Contrast Enhanced (1.4.6).
https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html

Görsel dikkat:
bottom-up vs top-down,
pop-out, fovea / parafovea tarama hızı,
chromostereopsis (kırmızı-mavi derinlik).

Renk psikolojisi (uygulamalı, laboratuvar değil):
sarı uyarı / periferi,
kırmızı tehdit / iştah,
pozitif polarite okuma hızı,
pupil-parlaklık ilişkisi.

Kısa video operatör raporları 2024–2026:
mute-first yüzde 80+,
hook 3 saniye,
3–7 kelime overlay,
15–30s kova,
skip-rate kapı modeli,
pattern interrupt 2–3s,
safe zone üst bant.

Bu projenin kendi kanıtı:
xxx / vv1 / harika varyantlarında yüzde 55–65 skip,
4 kesme opener ölümü,
beyaz kart reaktansı,
Outfit 900 yüklenmemesi,
yarı saydam plaka kontrast kaçışı,
ok + 4K freeze,
warmup ilk 2 saniye zehri.

Kurallar, bu iki kanıt katmanının kesişimidir:
dış araştırma + iç otopsi.

---

## 38. Haftalık ritim (operasyon)

Pazartesi: 2 harika2, aynı iskelet, iki farklı evre 1 kelime.
Salı: 24s skip oku. Kazanan kelimeyi kilitle.
Çarşamba: 2 spin, aynı kilit, farklı havuz.
Perşembe: skip oku. 13s vs 15s kararı.
Cuma: kazanan iskeletle 3 harika2, yalnızca isim havuzu yeni.
Hafta sonu: yeni format yok. Yalnızca kilitli iskelet.

Haftada birden fazla iskelet denemek,
hesabı “ne olduğunu belirsiz hesap” yapar.
Algoritma tutarlı formatı tanır.
İzleyici tutarlı vaadi tanır.

Aylık:
yalnızca skip yüzde 30 altına inmiş iskelet yaşar.
Üstünde kalan her şey arşivlenir, tekrar yayınlanmaz.

---

## 39. Check-list — kayıt öncesi 30 saniye

Kayıta basmadan önce:

[ ] Vaadi tek mi? (ordu-isim VEYA spin, ikisi birden değil)
[ ] İlk karede ada okunuyor mu, 200ms test
[ ] Evre 1 = 3 kelime
[ ] Evre 2 = ≤7 kelime, 3 satır
[ ] 4.0 saniyede yazı siliniyor mu
[ ] Ada #ffd54f opak mı, plaka yarı saydam değil mi
[ ] Yazı #111111, Inter Black 900 yüklü mü
[ ] Ünlem yok, @ yok
[ ] Kanca üst üçte birde mi
[ ] Kamera 0–4 kilitli mi
[ ] 1080p mi, dpr=2 değil mi
[ ] Ok yok mu
[ ] Antialias kapalı mı
[ ] Warmup kayda sızmıyor mu
[ ] Kapı kapalı, düşman yok, komutan yok
[ ] İsimler kancadan küçük mü
[ ] 18s kova (harika2) / 13s (spin)
[ ] Kapak = ilk kare
[ ] Açıklama vaadi tekrarlıyor mu

Bir kutu boşsa kayıt yok.

---

## 40. Son söz — izlenme bir sonuçtur, bir hedef değil

“Daha çok izlenme” bir düğme değildir.
Daha çok izlenme, skip kapısının kapanmasının sonucudur.

Kanca, o kapının kilididir.
Renk, kilidin görünürlüğüdür.
Yazı, kilidin dilidir.
Süre, kapının arkasındaki koridordur.
Teknik akıcılık, kapının pas tutmamasıdır.
Paylaşım, koridorun sonundaki kapıdır.

Bu sırayı tersine çeviren her taktik
(önce hashtag, önce trend ses, önce 4K, önce 4 kesme)
birinci kapıyı açık bırakır.
Birinci kapı açıkken yapılan her güzelleştirme
ölü videoyu daha güzel ölü yapar.

harika2 ve spin, bu belgedeki sıraya oturtulmuştur.
Bundan sonra iş, yeni teori üretmek değil,
24 saatte bir skip okuyup yalnızca kelimeyi sınamaktır.

Ölçülmeyen kanca, kanca değildir.
Kaydırılan video, sahne ne kadar güzel olursa olsun,
Keşfet’te yoktur.

---

## 41. Ek — 3 saniyelik kaydırma refleksinin anatomisi

Parmak, Reels’te bilinçten önce karar verir.
Karar 300–800 ms içinde başlar, 1.5–3.0 saniyede tamamlanır.
Bu pencere içinde beyin üç soru sorar:

1. Bu, az önce gördüğüm şeyin aynısı mı.
   Aynısıysa kaydır. Pattern interrupt’ın gerekçesi budur.

2. Bu, beni ilgilendiriyor mu.
   İsim, ordu, çekiliş, “sen” zamiri burada çalışır.
   Marka adı burada çalışmaz.

3. Bu, emek mi istiyor.
   Uzun yazı, karışık sahne, belirsiz vaat emek ister.
   Emek isteyen soğuk izleyici kaydırır.

Kanca, bu üç soruya 1.5 saniyede “hayır, evet, hayır”
demek zorundadır.
Hayır: aynı değil.
Evet: seninle ilgili.
Hayır: emek istemiyor, 3 kelime.

Bu üç cevap aynı karede durmazsa skip doğar.

---

## 42. Ek — yazı sitili (style) ayrıntı tablosu

Sitil burada “font ailesi”nden büyüktür.
Sitil, yazının sahne içindeki davranışıdır.

Büyük harf: evet, kanca satırlarında.
Küçük harf: site adı satırında (wargame.lol).
İtalik: asla. Hareketli zeminde erir.
Altı çizili: asla. UI linki sanılır.
Gölgeli her harf: asla. Ada varken gölge gereksizdir.
Gradyan yazı: asla. Sıkıştırmada çamur.
Neon stroke: asla. 2019 TikTok reklamı.
Emoji kancada: asla. Niş savaş, emoji genel eğlence.
Nokta: evre 1–2’de yok.
Virgül: yok.
Soru işareti: yalnızca “KİM KAZANIR” gibi 2–3 kelimede.
Ünlem: yok.

Türkçe karakterler:
İ, ayrı glif, I ile karışmaz.
ı, i ile karışmaz.
ğ, ş, ö, ü, ç gerçek glif.
BÜYÜK HARFTE İ: “İSMİN” doğru, “ISMIN” yanlış.
Font subset’i bu glifleri keserse kanca ölür.
Inter subset’ine Türkçe dahil edilmelidir.

---

## 43. Ek — renk kodları ve yasaklı palet

İzinli kanca paleti:

Ada: #ffd54f
Yazı: #111111
Ada kenarı (varsa): #1a1a1a
Sahne gökyüzü: mevcut gece paleti, kancaya karışmaz

İzinli spin paleti:

Zemin: #000000 veya #0a0a0a
İsim: #f5f5f5
Kazanan: #ffd54f
Kilit halkası: #f5f5f5 veya #ffd54f (ikisi birden değil)

Yasak palet:

#ffffff tam-ekran kart
#ff0000 tam-ada
#0000ff yazı veya kenar
#ff00ff neon
#00ffff neon
kırmızı-mavi herhangi bir çift
yarı saydam herhangi bir #000000aa plaka
altın yazı + altın ada (kontrast ölümü)

---

## 44. Ek — “daha çok izlenme” yalanları

Yalan 1: daha fazla hashtag = daha fazla izlenme.
Gerçek: 3–5 niş etiket, 30 çöp etiketten güçlüdür.

Yalan 2: trend ses = Keşfet garantisi.
Gerçek: niş dışına düşürür, skip üretir.

Yalan 3: 4K = daha profesyonel = daha çok izlenme.
Gerçek: 4K bu sahnede freeze, freeze skip.

Yalan 4: uzun video = daha çok izlenme süresi = algoritma sever.
Gerçek: yanlış kovada ortalama yüzde düşer.

Yalan 5: her gün 10 video.
Gerçek: 10 ölü video, hesabı “ölü üretici” yapar.
1 kilitli iskelet × 1–3/gün daha temiz sinyaldir.

Yalan 6: kırmızı + ünlem = dikkat.
Gerçek: dikkat değil, reklam yargısı.

Yalan 7: ilk 3 saniyede çok kesme = modern kurgu.
Gerçek: modern reklam kurgusu, Reels soğuk izleyicisi kaydırır.

Yalan 8: logo her karede = marka.
Gerçek: logo, vaadin yerini yer. Marka, isim bulununca gelir.

---

## 45. Belge sürümü

Sürüm: 1.0
Tarih: 22 Eylül 2026
Kapsam: Reels skip-kapı mimarisi, kanca, renk, yazı, süre,
ses, teknik, paylaşım, harika2 ve spin uygulaması.
Satır hedefi: ≥500.
Bu belge kök dizinde durur. Üretimden önce okunur.
Üretim, belgedeki check-list’siz başlamaz.

Son satır kuralı:
kanca 3 kelimedir, video 18 saniyedir, skip kapıdır.
Geri kalan her şey bu üçünün hizmetçisidir.
)
