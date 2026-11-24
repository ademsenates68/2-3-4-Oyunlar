/**
 * CubeArena .io — Google Play Store Uyumlu Gizlilik Politikası & Kullanım Koşulları Modalları
 */

import React from 'react';
import { soundEngine } from '../js/audio';

export type ModalType = 'privacy' | 'terms' | 'aab-guide' | null;

interface LegalModalsProps {
  activeModal: ModalType;
  onClose: () => void;
}

export const LegalModals: React.FC<LegalModalsProps> = ({ activeModal, onClose }) => {
  if (!activeModal) return null;

  const handleClose = () => {
    soundEngine.playClick();
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4"
    >
      <div className="relative flex max-h-[86vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-800 bg-[#0F172A] text-slate-100 shadow-2xl">
        {/* Başlık */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <h2 id="legal-modal-title" className="font-display text-xl font-bold tracking-tight text-white">
            {activeModal === 'privacy' && 'Gizlilik Politikası (Privacy Policy)'}
            {activeModal === 'terms' && 'Kullanım Koşulları (Terms of Use)'}
            {activeModal === 'aab-guide' && 'Google Play Store (.AAB) Derleme Rehberi'}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Kapat"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 transition-transform active:scale-95 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* İçerik */}
        <div className="custom-scroll flex-1 space-y-4 overflow-y-auto px-6 py-5 text-sm leading-relaxed text-slate-300">
          {activeModal === 'privacy' && (
            <>
              <p className="font-medium text-cyan-400">
                Son Güncelleme: Kasım 2026 · Google Play Store Veri Güvenliği Uyumluluğu
              </p>
              <div className="rounded-xl border border-cyan-500/30 bg-slate-900/90 p-4 text-slate-200">
                <strong>Özet Beyan (Sıfır Veri Toplama):</strong> CubeArena .io uygulaması hiçbir
                kişisel verinizi toplamaz, saklamaz, işlemez veya üçüncü taraflarla paylaşmaz.
                Tüm oyunlar %100 çevrimdışı (offline) olarak kendi cihazınız üzerinde çalışır.
              </div>
              <h3 className="font-display text-base font-semibold text-white">
                1. Toplanmayan Veriler
              </h3>
              <p>
                Uygulamamız kullanıcı adı, e-posta adresi, telefon numarası, konum bilgisi (GPS),
                cihaz kimliği (Advertising ID), rehber, kamera, mikrofon veya fotoğraf galerisi
                gibi hiçbir kişisel ya da hassas cihaz verisine erişim talep etmez ve toplamaz.
              </p>
              <h3 className="font-display text-base font-semibold text-white">
                2. Yerel Çalışma ve Çok Oyunculu Mimari
              </h3>
              <p>
                2, 3 ve 4 kişilik oyun modlarının tamamı tek bir telefon veya tablet ekranı
                üzerinden yerel çoklu dokunmatik (Multi-Touch) teknolojisiyle oynanır. İnternet
                bağlantısı veya uzak sunucu iletişimi gerektirmez. Oyun içi skor tablosu yalnızca
                aktif oturum süresince cihaz belleğinde (RAM) tutulur.
              </p>
              <h3 className="font-display text-base font-semibold text-white">
                3. Çocukların Gizliliği (COPPA & Aile Politikası)
              </h3>
              <p>
                Uygulamamız her yaştan oyuncu için güvenlidir. Çocuklardan veya yetişkinlerden
                hiçbir veri toplanmadığı ve üçüncü taraf izleme SDK’ları (analitik veya reklam
                ağları) bulunmadığı için Google Play Aile Politikası ve COPPA standartlarına
                tam uyumludur.
              </p>
              <h3 className="font-display text-base font-semibold text-white">
                4. İletişim
              </h3>
              <p>
                Gizlilik politikamızla ilgili sorularınız için geliştirici destek kanalı üzerinden
                bizimle iletişime geçebilirsiniz: <span>privacy@cubearena.io</span>
              </p>
            </>
          )}

          {activeModal === 'terms' && (
            <>
              <p className="font-medium text-pink-400">
                Yürürlük Tarihi: Kasım 2026 · CubeArena .io Lisans ve Kullanım Koşulları
              </p>
              <h3 className="font-display text-base font-semibold text-white">
                1. Hizmetin Kapsamı
              </h3>
              <p>
                CubeArena .io; tek bir mobil cihaz veya tablet ekranı üzerinde 2, 3 veya 4 kişinin
                aynı anda karşılıklı oynayabileceği 8 adet minimalist geometrik mini oyundan oluşan
                bir eğlence uygulamasıdır. Uygulamayı indirerek veya kullanarak bu koşulları kabul
                etmiş sayılırsınız.
              </p>
              <h3 className="font-display text-base font-semibold text-white">
                2. Güvenli Çoklu Dokunmatik Kullanım Uyarısı
              </h3>
              <p>
                Aynı ekranda 2 ila 4 oyuncunun heyecanlı mücadelesi sırasında cihazınızın düşmesini
                veya kaymasını önlemek için telefonunuzu ya da tabletinizi düz, kaymaz bir yüzey
                (masa veya sehpa) üzerine yerleştirerek oynamanız tavsiye edilir.
              </p>
              <h3 className="font-display text-base font-semibold text-white">
                3. Fikri Mülkiyet Hakları
              </h3>
              <p>
                Uygulama içerisindeki tüm HTML5 Canvas geometrik çizim algoritmaları, Web Audio API
                sentezleyici ses kodları, kullanıcı arayüzü tasarımları ve oyun mekanikleri telif
                hakları kapsamında korunmaktadır.
              </p>
              <h3 className="font-display text-base font-semibold text-white">
                4. Sorumluluk Sınırlandırması
              </h3>
              <p>
                Uygulama &ldquo;olduğu gibi&rdquo; (as-is) sunulmaktadır ve tamamen ücretsiz,
                çevrimdışı yerel eğlence amaçlıdır.
              </p>
            </>
          )}

          {activeModal === 'aab-guide' && (
            <>
              <p className="text-slate-300">
                Bu proje <strong>capacitor.config.json</strong> ve <strong>manifest.json</strong>{' '}
                dosyalarıyla birlikte Google Play Store <strong>.aab (Android App Bundle)</strong>{' '}
                çıktısına hazırdır. Bilgisayarınızda aşağıdaki terminal komutlarını sırasıyla
                çalıştırabilirsiniz:
              </p>
              <pre className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono-tabular text-xs text-cyan-300">
{`# 1. Bağımlılıkları ve Capacitor paketlerini kurun
npm install
npm install @capacitor/core @capacitor/cli @capacitor/android

# 2. Web projesini derleyin (dist klasörü oluşur)
npm run build

# 3. Android platformunu ekleyin ve dosyaları senkronize edin
npx cap add android
npx cap sync android

# 4. Android Studio'yu açın
npx cap open android

# 5. Android Studio içinde imzalı .aab çıktısı alın:
# Build -> Generate Signed Bundle / APK -> Android App Bundle (.aab)`}
              </pre>
            </>
          )}
        </div>

        {/* Alt Buton */}
        <div className="flex justify-end border-t border-slate-800 px-6 py-4">
          <button
            type="button"
            onClick={handleClose}
            className="min-h-[44px] rounded-xl bg-cyan-400 px-6 py-2.5 font-display text-sm font-bold text-slate-950 transition-transform active:scale-95"
          >
            Anladım, Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
