# Impostor Party (React + Express + Neon)

Kompletna gra imprezowa typu Impostor:
- lobby z kodem 6-cyfrowym,
- role (uczestnik/impostor),
- rundy, glosowanie, eliminacje,
- jednorazowy strzal impostora,
- reset gry do lobby.

## Stack
- Frontend: React + Vite + Tailwind CSS
- Backend: Express + Socket.IO
- DB: Neon Postgres + Prisma ORM

## Lokalnie
1. Zainstaluj paczki:
   - `npm install`
2. Skonfiguruj backend:
   - skopiuj `server/.env.example` do `server/.env`
   - ustaw `DATABASE_URL` na Neon
3. Zmigruj i zasil baze:
   - `npm run prisma:push -w server`
   - `npm run prisma:generate -w server`
   - `npm run prisma:seed -w server`
4. Odpal dev:
   - backend: `npm run dev:server`
   - frontend: `npm run dev:client`

## Deploy na Vercel
Najprosciej jako dwa projekty:

### 1) Backend (`server`)
- Root directory: `server`
- Build command: `npm install && npm run build`
- Start command: `npm run start`
- Env:
  - `DATABASE_URL`
  - `PORT` (opcjonalnie)

### 2) Frontend (`client`)
- Root directory: `client`
- Build command: `npm install && npm run build`
- Output: `dist`
- Env:
  - `VITE_API_URL` = URL backendu z Vercel

## Kategorie i hasla
Seed zawiera 6 kategorii i minimum 40 hasel na kazda:
- SPORT
- ZWIERZETA
- JEDZENIE
- MIEJSCE
- ZAWOD
- WYDARZENIE
