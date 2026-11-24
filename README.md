# CubeArena .io — 2, 3, 4 Kişilik .io Mini Oyunlar Koleksiyonu

Tek bir telefon, tablet veya bilgisayar ekranından aynı anda **2, 3 veya 4 kişinin** karşılıklı oynayabileceği, Google Play Store (`.aab`) yayınlanmaya hazır, minimalist küp/geometrik tarzda **8 adet `.io` mini oyun koleksiyonu**.

---

## 📦 Proje Dosya Yapısı (Tam Kaynak Kod Listesi)

```text
cubearena-io/
├── index.html                        # Ana HTML5 giriş noktası ve PWA/Mobil meta etiketleri
├── package.json                      # Proje bağımlılıkları ve derleme (build/lint) komutları
├── tsconfig.json                     # TypeScript yapılandırması
├── vite.config.ts                    # Vite derleyici ve kaynak kodu ZIP paketleyici yapılandırması
├── capacitor.config.json             # Google Play Store (.aab / Android) Capacitor yapılandırması
├── manifest.json                     # PWA Web App Manifest (tam ekran yatay/dikey mobil uyum)
├── public/
│   ├── manifest.json                 # Statik PWA manifest dosyası
│   └── cubearena-io-full-project.zip # Tek tıkla indirilebilir tam proje kaynak kod paketi
└── src/
    ├── main.tsx                      # React DOM bağlayıcı
    ├── index.css                     # Tailwind CSS ve özel dokunmatik arena stilleri
    ├── App.tsx                       # Ana oyun kabuğu, 60 FPS Canvas döngüsü ve ekran yönetimi
    ├── components/
    │   ├── AchievementToast.tsx      # Başarım (Achievements) bildirimi (toast) ve modalı
    │   ├── GameStats.tsx             # Tur sonu oyuncu performans (İmha, Mesafe, Sıralama) tablosu
    │   ├── LegalModals.tsx           # Gizlilik Politikası, Kullanım Koşulları, GitHub & .AAB Rehberi
    │   └── PlayerTouchControls.tsx   # 2, 3 ve 4 kişilik bağımsız çoklu dokunmatik kontrol panelleri
    └── js/
        ├── achievements.ts           # localStorage tabanlı Başarımlar (10 Oyun, 100 İmha vb.)
        ├── audio.ts                  # Web Audio API sentezleyici ses motoru + navigator.vibrate titreşim
        ├── controls.ts               # touch.identifier tabanlı 4 kişilik Multi-Touch + Klavye kontrolcüsü
        ├── particles.ts              # Geometrik parçacık (particle) ve neon ızgara çizim motoru
        ├── rules.ts                  # Oyun kuralları, fizik matematiği ve localStorage skor kaydı
        ├── rules.test.ts             # Birim testleri (node:test)
        └── games/
            ├── index.ts              # Mini oyun fabrikası (8 oyun seçici)
            ├── types.ts              # Ortak oyun motoru ve HUD veri arayüzleri
            ├── cubeRoyale.ts         # 1. Oyun: Cube Royale (Kule Savunma & 4 Birlik Saldırısı)
            ├── tankIo.ts             # 2. Oyun: Tank.io (Duvarlı Arena, 2 Mermi & Güçlendirme Küreleri)
            ├── evoWars.ts            # 3. Oyun: EvoWars.io (XP Evrim, Tek Vuruş Kılıç & %40 XP Ödülü)
            ├── miniGiants.ts         # 4. Oyun: MiniGiants.io (Can Barlı Yakın Dövüş & XP Hazinesi)
            ├── agarIo.ts             # 5. Oyun: Agar.io (Kütle Yutma & Merkez Kapsama)
            ├── snakeIo.ts            # 6. Oyun: Snake.io (Neon Yılan Arenası & Parlak Gövde İzi)
            ├── turboDrift.ts         # 7. Oyun: Turbo Drift (3 Turluk Üstten Görünümlü Drift Yarışı)
            └── arenaFutbol.ts        # 8. Oyun: Arena Futbol (2-3-4 Kaleli Fizik Futbolu)
```

---

## 🛠️ Kurulum ve Çalıştırma

Bilgisayarınızda projeyi çalıştırmak için:

```bash
# 1. Bağımlılıkları yükleyin
npm install

# 2. Geliştirme sunucusunu başlatın (http://localhost:3000)
npm run dev

# 3. Birim testlerini çalıştırın
npx tsx --test src/js/rules.test.ts

# 4. Canlı yayın (Production) çıktısı alın (dist/ klasörü oluşur)
npm run build
```

---

## 📱 Google Play Store (`.AAB`) Çıktısı Alma

```bash
# 1. Capacitor Android paketlerini kurun
npm install @capacitor/core @capacitor/cli @capacitor/android

# 2. Web uygulamasını derleyin
npm run build

# 3. Android projesini oluşturun ve senkronize edin
npx cap add android
npx cap sync android

# 4. Android Studio'da açıp imzalı .aab üretin
npx cap open android
# Android Studio -> Build -> Generate Signed Bundle / APK -> Android App Bundle (.aab)
```

---

## ❓ GitHub'da Neden Sadece `README.md` Görünüyor? Nasıl Düzeltilir?

GitHub üzerinde yeni bir depo (repository) açarken **"Add a README file"** seçeneği işaretlendiyse veya dışa aktarma sırasında farklı bir dal (`branch`) seçildiyse:
1. GitHub deponuzun sol üst kısmındaki **`main` / `master` dal (branch) seçicisini** kontrol edin; dosyalarınız yeni bir dala gönderilmiş olabilir.
2. Veya uygulamanın ana menüsündeki **"📥 Proje ZIP İndir"** butonuna tıklayarak `cubearena-io-full-project.zip` dosyasını bilgisayarınıza indirin, klasöre çıkartın ve GitHub deponuzda **"Add file" -> "Upload files"** ekranına tüm dosyaları sürükleyip **"Commit changes"** butonuna basın.
