import { PrismaClient, Category } from "@prisma/client";

const prisma = new PrismaClient();

type Entry = { phrase: string; hint: string };

const words: Record<Category, Entry[]> = {
  SPORT: [
    { phrase: "Pilka nozna", hint: "11 na boisku" }, { phrase: "Koszykowka", hint: "Tablica i kosz" },
    { phrase: "Siatkowka", hint: "Przez siatke" }, { phrase: "Tenis", hint: "Rakieta i kort" },
    { phrase: "Boks", hint: "Rekawice i ring" }, { phrase: "Plywanie", hint: "Basen" },
    { phrase: "Bieganie", hint: "Buty sportowe" }, { phrase: "Kolarstwo", hint: "Rower" },
    { phrase: "Narciarstwo", hint: "Stok" }, { phrase: "Snowboard", hint: "Deska zimowa" },
    { phrase: "Hokej", hint: "Kij i krażek" }, { phrase: "Golf", hint: "Dołki" },
    { phrase: "Rugby", hint: "Jajowata pilka" }, { phrase: "Pilka reczna", hint: "Bramka halowa" },
    { phrase: "Badminton", hint: "Lotka" }, { phrase: "Szermierka", hint: "Maska i szpada" },
    { phrase: "Zapasy", hint: "Mata" }, { phrase: "Judo", hint: "Gi" },
    { phrase: "Karate", hint: "Kata" }, { phrase: "Wspinaczka", hint: "Scianka" },
    { phrase: "Surfing", hint: "Fale" }, { phrase: "Wioslarstwo", hint: "Lodz i wiosla" },
    { phrase: "Skoki narciarskie", hint: "Skocznia" }, { phrase: "Formula 1", hint: "Bolid" },
    { phrase: "Rajdy", hint: "Odcinki specjalne" }, { phrase: "Baseball", hint: "Kij i bazy" },
    { phrase: "Football amerykanski", hint: "Touchdown" }, { phrase: "Triathlon", hint: "3 dyscypliny" },
    { phrase: "Biegi narciarskie", hint: "Narty plaskie" }, { phrase: "Lyzwiarstwo figurowe", hint: "Piruety" },
    { phrase: "Lyzwiarstwo szybkie", hint: "Tor lodowy" }, { phrase: "Skateboarding", hint: "Triki na desce" },
    { phrase: "Parkour", hint: "Miejskie przeszkody" }, { phrase: "Kręgle", hint: "10 kregli" },
    { phrase: "Darts", hint: "Tarcza i lotki" }, { phrase: "Bilard", hint: "Stol i bile" },
    { phrase: "Podnoszenie ciezarow", hint: "Sztanga" }, { phrase: "Crossfit", hint: "WOD" },
    { phrase: "Jogging", hint: "Lekki bieg" }, { phrase: "Maraton", hint: "42 km" }
  ],
  ZWIERZETA: [
    { phrase: "Pies", hint: "Najlepszy przyjaciel" }, { phrase: "Kot", hint: "Mruczy" },
    { phrase: "Lew", hint: "Krol sawanny" }, { phrase: "Tygrys", hint: "Pasy" },
    { phrase: "Slon", hint: "Traba" }, { phrase: "Zyrafa", hint: "Dluga szyja" },
    { phrase: "Wilk", hint: "Wataha" }, { phrase: "Lis", hint: "Rudy spryciarz" },
    { phrase: "Niedzwiedz", hint: "Miod" }, { phrase: "Krolik", hint: "Dlugie uszy" },
    { phrase: "Mysz", hint: "Ser" }, { phrase: "Szczur", hint: "Kanalizacja" },
    { phrase: "Kon", hint: "Stajnia" }, { phrase: "Krowa", hint: "Mleko" },
    { phrase: "Owca", hint: "Welna" }, { phrase: "Koza", hint: "Rogi" },
    { phrase: "Swinia", hint: "Chlew" }, { phrase: "Kura", hint: "Jajka" },
    { phrase: "Kaczka", hint: "Kwakanie" }, { phrase: "Gęś", hint: "Syczenie" },
    { phrase: "Orzel", hint: "Drapiezny ptak" }, { phrase: "Sokol", hint: "Lot nurkowy" },
    { phrase: "Papuga", hint: "Powtarza slowa" }, { phrase: "Pingwin", hint: "Antarktyda" },
    { phrase: "Foka", hint: "Pletwy" }, { phrase: "Delfin", hint: "Inteligentny ssak" },
    { phrase: "Rekin", hint: "Pletwa grzbietowa" }, { phrase: "Wieloryb", hint: "Oceaniczny olbrzym" },
    { phrase: "Zolw", hint: "Skorupa" }, { phrase: "Krokodyl", hint: "Mocne szczeki" },
    { phrase: "Waz", hint: "Bez nog" }, { phrase: "Jaszczurka", hint: "Ogon" },
    { phrase: "Zaba", hint: "Kumkanie" }, { phrase: "Nietoperz", hint: "Echolokacja" },
    { phrase: "Pszczola", hint: "Ul i miod" }, { phrase: "Motyl", hint: "Skrzydla" },
    { phrase: "Mrowka", hint: "Kolonia" }, { phrase: "Pajak", hint: "Siec" },
    { phrase: "Jez", hint: "Kolce" }, { phrase: "Chomik", hint: "Kolowrotek" }
  ],
  JEDZENIE: [
    { phrase: "Pizza", hint: "Wloski placek" }, { phrase: "Burger", hint: "Bulka i kotlet" },
    { phrase: "Spaghetti", hint: "Makaron nitki" }, { phrase: "Sushi", hint: "Ryż i nori" },
    { phrase: "Pierogi", hint: "Polskie ciasto" }, { phrase: "Bigos", hint: "Kapusta" },
    { phrase: "Zurek", hint: "Zakwas" }, { phrase: "Rosol", hint: "Niedzielna zupa" },
    { phrase: "Pomidorowa", hint: "Czerwna zupa" }, { phrase: "Nalesniki", hint: "Cienkie ciasto" },
    { phrase: "Gofry", hint: "Krata ciasta" }, { phrase: "Lody", hint: "Na zimno" },
    { phrase: "Czekolada", hint: "Kakao" }, { phrase: "Sernik", hint: "Twarog" },
    { phrase: "Jablko", hint: "Owoc z sadu" }, { phrase: "Banan", hint: "Zolty owoc" },
    { phrase: "Pomarancza", hint: "Cytrus" }, { phrase: "Arbuz", hint: "Duzy i soczysty" },
    { phrase: "Kanapka", hint: "Chleb i dodatki" }, { phrase: "Tost", hint: "Opiekany chleb" },
    { phrase: "Jajecznica", hint: "Sniadanie z jaj" }, { phrase: "Omlet", hint: "Skladany placek jajeczny" },
    { phrase: "Stek", hint: "Wolowina" }, { phrase: "Kurczak pieczony", hint: "Piekarnik" },
    { phrase: "Frytki", hint: "Smazone ziemniaki" }, { phrase: "Salatka grecka", hint: "Feta i oliwki" },
    { phrase: "Kebab", hint: "Mieso i sos" }, { phrase: "Taco", hint: "Meksykanska tortilla" },
    { phrase: "Burrito", hint: "Zawijana tortilla" }, { phrase: "Ramen", hint: "Japonski bulion" },
    { phrase: "Curry", hint: "Aromatyczne przyprawy" }, { phrase: "Risotto", hint: "Kremowy ryz" },
    { phrase: "Lasagne", hint: "Warstwowy makaron" }, { phrase: "Pesto", hint: "Bazylia i orzeszki" },
    { phrase: "Chleb", hint: "Podstawa pieczywa" }, { phrase: "Maslo", hint: "Na kanapki" },
    { phrase: "Ser", hint: "Nabial" }, { phrase: "Jogurt", hint: "Fermentowane mleko" },
    { phrase: "Miod", hint: "Od pszczol" }, { phrase: "Orzechy", hint: "Chrupiace" }
  ],
  MIEJSCE: [
    { phrase: "Szkola", hint: "Lekcje" }, { phrase: "Szpital", hint: "Leczenie" },
    { phrase: "Lotnisko", hint: "Odloty" }, { phrase: "Dworzec", hint: "Pociagi" },
    { phrase: "Plaża", hint: "Piasek i morze" }, { phrase: "Gory", hint: "Szczyty" },
    { phrase: "Las", hint: "Drzewa" }, { phrase: "Park", hint: "Alejki" },
    { phrase: "Kino", hint: "Film" }, { phrase: "Teatr", hint: "Scena" },
    { phrase: "Biblioteka", hint: "Ksiazki" }, { phrase: "Muzeum", hint: "Eksponaty" },
    { phrase: "Restauracja", hint: "Menu" }, { phrase: "Kawiarnia", hint: "Kawa" },
    { phrase: "Sklep", hint: "Zakupy" }, { phrase: "Supermarket", hint: "Wozki" },
    { phrase: "Stadion", hint: "Kibice" }, { phrase: "Basen", hint: "Tory plywackie" },
    { phrase: "Silownia", hint: "Trening" }, { phrase: "Biuro", hint: "Praca przy biurku" },
    { phrase: "Fabryka", hint: "Produkcja" }, { phrase: "Magazyn", hint: "Palety" },
    { phrase: "Wieś", hint: "Mniej zabudowy" }, { phrase: "Miasto", hint: "Duzy ruch" },
    { phrase: "Most", hint: "Nad rzeka" }, { phrase: "Tunel", hint: "Pod ziemia" },
    { phrase: "Autostrada", hint: "Szybka droga" }, { phrase: "Stacja paliw", hint: "Tankowanie" },
    { phrase: "Hotel", hint: "Noclegi" }, { phrase: "Hostel", hint: "Tanszy nocleg" },
    { phrase: "Zamek", hint: "Historia i mury" }, { phrase: "Rynek", hint: "Centrum miasta" },
    { phrase: "Plac zabaw", hint: "Hustawki" }, { phrase: "Plac budowy", hint: "Dzwig" },
    { phrase: "Kosciol", hint: "Nabozenstwo" }, { phrase: "Cmentarz", hint: "Nagrobki" },
    { phrase: "Komisariat", hint: "Policja" }, { phrase: "Straznica", hint: "Straz pozarna" },
    { phrase: "Port", hint: "Statki" }, { phrase: "Przystanek", hint: "Autobus" }
  ],
  ZAWOD: [
    { phrase: "Lekarz", hint: "Diagnoza" }, { phrase: "Pielęgniarka", hint: "Opieka medyczna" },
    { phrase: "Nauczyciel", hint: "Lekcje" }, { phrase: "Programista", hint: "Kod" },
    { phrase: "Tester", hint: "Bledy" }, { phrase: "Architekt", hint: "Projekty budynkow" },
    { phrase: "Budowlaniec", hint: "Beton i cegly" }, { phrase: "Stolarz", hint: "Drewno" },
    { phrase: "Hydraulik", hint: "Rury" }, { phrase: "Elektryk", hint: "Instalacje" },
    { phrase: "Mechanik", hint: "Warsztat" }, { phrase: "Kierowca", hint: "Transport" },
    { phrase: "Pilot", hint: "Samolot" }, { phrase: "Stewardessa", hint: "Poklad" },
    { phrase: "Kucharz", hint: "Kuchnia" }, { phrase: "Kelner", hint: "Obsluga stolikow" },
    { phrase: "Barista", hint: "Ekspres do kawy" }, { phrase: "Piekarz", hint: "Piec" },
    { phrase: "Rzeźnik", hint: "Zaklad miesny" }, { phrase: "Rolnik", hint: "Gospodarstwo" },
    { phrase: "Weterynarz", hint: "Leczy zwierzeta" }, { phrase: "Farmaceuta", hint: "Apteka" },
    { phrase: "Prawnik", hint: "Przepisy" }, { phrase: "Sędzia", hint: "Wyroki" },
    { phrase: "Policjant", hint: "Patrol" }, { phrase: "Strazak", hint: "Gaszenie pozaru" },
    { phrase: "Ratownik", hint: "Pierwsza pomoc" }, { phrase: "Zolnierz", hint: "Wojsko" },
    { phrase: "Dziennikarz", hint: "Material prasowy" }, { phrase: "Fotograf", hint: "Obiektyw" },
    { phrase: "Aktor", hint: "Plan filmowy" }, { phrase: "Muzyk", hint: "Instrument" },
    { phrase: "DJ", hint: "Mikser" }, { phrase: "Grafik", hint: "Projekty wizualne" },
    { phrase: "Projektant UX", hint: "Interfejs" }, { phrase: "Manager projektu", hint: "Harmonogram" },
    { phrase: "Ksiegowy", hint: "Faktury" }, { phrase: "Analityk danych", hint: "Wykresy" },
    { phrase: "Sprzedawca", hint: "Klient" }, { phrase: "Magik", hint: "Iluzja" }
  ],
  WYDARZENIE: [
    { phrase: "Wesele", hint: "Mloda para" }, { phrase: "Urodziny", hint: "Tort i swieczki" },
    { phrase: "Sylwester", hint: "Odliczanie" }, { phrase: "Koncert", hint: "Scena i muzyka" },
    { phrase: "Mecz finalowy", hint: "Wielki final" }, { phrase: "Turniej", hint: "Drabinka" },
    { phrase: "Maraton miejski", hint: "Bieg uliczny" }, { phrase: "Parada", hint: "Przemarsz" },
    { phrase: "Festiwal", hint: "Kilka dni atrakcji" }, { phrase: "Konferencja", hint: "Prelekcje" },
    { phrase: "Warsztaty", hint: "Praktyczne zajecia" }, { phrase: "Szkolenie", hint: "Nauka umiejetnosci" },
    { phrase: "Egzamin", hint: "Test wiedzy" }, { phrase: "Studniowka", hint: "Taniec przed matura" },
    { phrase: "Matura", hint: "Egzamin koncowy" }, { phrase: "Obrona pracy", hint: "Dyplom" },
    { phrase: "Rekrutacja", hint: "Rozmowa o prace" }, { phrase: "Rozmowa kwalifikacyjna", hint: "HR" },
    { phrase: "Spotkanie zespolu", hint: "Statusy" }, { phrase: "Hackathon", hint: "Kodowanie nocne" },
    { phrase: "Premiera filmu", hint: "Czerwony dywan" }, { phrase: "Premiera gry", hint: "Dzien wydania" },
    { phrase: "Otwarcie sklepu", hint: "Nowy punkt" }, { phrase: "Wyprzedaz", hint: "Rabaty" },
    { phrase: "Aukcja", hint: "Licytacja" }, { phrase: "Targi", hint: "Stoiska" },
    { phrase: "Mecz towarzyski", hint: "Bez stawki" }, { phrase: "Debata", hint: "Wymiana argumentow" },
    { phrase: "Wybory", hint: "Glosy obywateli" }, { phrase: "Protest", hint: "Transparenty" },
    { phrase: "Slub cywilny", hint: "Urzad stanu" }, { phrase: "Chrzest", hint: "Ceremonia rodzinna" },
    { phrase: "Komunia", hint: "Uroczystosc koscielna" }, { phrase: "Rocznica", hint: "Uplyw czasu" },
    { phrase: "Piknik", hint: "Koc i kosz" }, { phrase: "Grill", hint: "Ruszt" },
    { phrase: "Impreza firmowa", hint: "Integracja" }, { phrase: "Noc muzeow", hint: "Zwiedzanie nocne" },
    { phrase: "Pokaz mody", hint: "Wybieg" }, { phrase: "Ceremonia rozdania nagrod", hint: "Statuetki" }
  ]
};

async function main() {
  await prisma.wordBank.deleteMany();
  for (const [category, entries] of Object.entries(words) as [Category, Entry[]][]) {
    for (const entry of entries) {
      await prisma.wordBank.create({
        data: {
          category,
          phrase: entry.phrase,
          hint: entry.hint
        }
      });
    }
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
