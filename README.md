# Kuşatma

Instagram takip büyümesi için canlı 3D kale kuşatması. Asker sayısı Firebase Realtime Database'de tutulur; sahnede en fazla 280 instanced birim çizilir, bu yüzden takipçi sayısı artsa da FPS düşmez.

## Döngü

- Anasayfa herkese açık düşman kalesini gösterir.
- Üst barda Instagram hesabı, asker/takipçi sayısı, kale gücü ve seviye vardır.
- Kale her zaman ordudan güçlüdür. Ordu kale gücüne yetişince kale otomatik seviye atlar.
- Ziyaretçi textarea'ya kendi `@hesabını` yazar → askere katılır ve **Takip et** ile senin Instagram'ına gider.
- Admin (`admin@servis.com`) `/admin` panelinden gerçek takipçi sayısını orduya işler.

Kale gücü: `10000 × 3^(seviye-1)`  
Seviye 1 = 10.000, seviye 2 = 30.000, seviye 3 = 90.000…

## Kurulum

```bash
npm install
npm run dev
```

Yerel: [http://localhost:5173](http://localhost:5173)  
Admin: [http://localhost:5173/admin](http://localhost:5173/admin)

## Firebase kuralları

Firebase Console → Realtime Database → Rules içine `database.rules.json` içeriğini yapıştır ve yayınla.

Storage kullanacaksan (Reels dosya yükleme) `storage.rules` dosyasını Storage Rules'a yayınla.

Authentication'da e-posta/şifre açık olmalı. Admin kullanıcısı: `admin@servis.com`.

İlk açılışta `game` düğümü yoksa admin panelinden asker sayısı veya Instagram hesabını kaydet.

## GitHub + Vercel

```bash
git init
git add .
git commit -m "Kuşatma: 3D kale, admin panel, Firebase"
git branch -M main
git remote add origin https://github.com/KULLANICI/REPO.git
git push -u origin main
```

Vercel'de projeyi import et, framework **Vite**. Environment variables için `.env.example` değerlerini ekle (veya bırak, kod içinde aynı Firebase config yedekli).

## Rotalar

- `/` anasayfa ve 3D kuşatma
- `/admin` veya `/adminpanel` yönetici girişi
