# Jedna instancja (backend + frontend razem) krok po kroku

Ten plik opisuje deployment jako **jeden serwis Node**, gdzie:
- `client` buduje statyczny frontend,
- `server` (Express + socket.io) serwuje API i realtime,
- ten sam `server` serwuje tez pliki frontendu z `client/dist`.

To jest wariant bez stawiania osobno backendu i frontendu.

## Uwaga o Vercel

Przy obecnym `socket.io` najlepszy i najstabilniejszy wariant "jedna instancja" to platforma typu Railway/Render/Fly (normalny proces Node).  
Vercel jest platforma serverless i dla takiej architektury realtime bywa problematyczny.

Jesli chcesz koniecznie zostac na Vercel i miec stabilny realtime, trzeba przepiac realtime na inna usluge (np. Supabase Realtime, Ably, Pusher).

---

## Krok po kroku (jedna instancja, jeden deploy)

## 1) Przygotuj repo na GitHub
W katalogu projektu:

```bash
git init
git add .
git commit -m "Initial impostor game"
git branch -M main
git remote add origin https://github.com/TWOJ_LOGIN/TWOJE_REPO.git
git push -u origin main
```

## 2) NeonDB
1. Załóż bazę w Neon.
2. Skopiuj connection string `DATABASE_URL`.
3. Lokalnie odpal:

```bash
npm install
npm run prisma:generate
npm run prisma:push
npm run prisma:seed
```

## 3) Jedna usluga na Railway/Render/Fly
Root directory: **repo root** (`d:/coding/gry`)

Build command:
```bash
npm install && npm run prisma:generate && npm run build
```

Start command:
```bash
npm run start
```

Env variables:
- `DATABASE_URL` = z Neon
- `PORT` = platforma ustawi sama
- `CLIENT_DIST_PATH` = opcjonalne (zostaw puste; domyslnie server bierze `../client/dist`)

Po deployu dostajesz jeden URL aplikacji, np.:
`https://impostor-party-production.up.railway.app`

## 4) Frontend + backend razem pod jednym adresem
Nie ustawiasz osobnego frontendu i osobnego backendu.

`server/src/index.ts` automatycznie:
- obsluguje `/api/*`,
- obsluguje socket.io,
- serwuje frontend z `client/dist`.

W tym wariancie `VITE_API_URL` nie jest potrzebne (domyslnie leci na ten sam origin).

## 5) CORS
W `server/src/index.ts` aktualnie jest:

```ts
app.use(cors({ origin: "*" }));
```

To zadziala. Przy jednej domenie i jednej instancji mozesz to potem zawezic.

## 6) Checklist po deployu
1. Front otwiera sie na jednej domenie.
2. Tworzenie lobby działa.
3. Join po kodzie 6 cyfr działa.
4. Realtime aktualizuje wszystkich graczy.
5. Głosowanie i guess impostora działają.

---

## Odpowiedź na Twoje pytania (wprost)

- **Czy moge miec backend i frontend w jednym projekcie?**  
  Tak. Ten projekt jest teraz ustawiony pod jeden serwis Node.

- **Czy musze stawiac osobny backend?**  
  Nie, nie musisz. Wdrazasz wszystko jako jedna usluge.

- **Jakie env sa wymagane?**  
  Wymagane: `DATABASE_URL`.

---

## Dodatkowo (jezeli koniecznie Vercel)

Jesli koniecznie chcesz Vercel, musimy zmienic realtime (odejsc od aktualnego `socket.io` serwera procesu).
