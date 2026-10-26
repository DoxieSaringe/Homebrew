// Exempel på beredskapsdata. Används automatiskt om data/beredskap.js saknas.
// Den riktiga filen innehåller namn och telefonnummer och ska INTE committas (se .gitignore).
window.BEREDSKAP = {
  ar: 2026,
  grupper: [
    { namn: 'Grupp 1', veckor: [2, 6, 10, 14, 18, 22, 26, 30, 34, 38, 42, 46, 50], personal: [
      { roll: 'SL', namn: '43AA Förnamn Efternamn', tel: '070-000 00 01' },
      { roll: 'CH', namn: '4301 Förnamn Efternamn', tel: '070-000 00 02' },
      { roll: 'RD', namn: '4302 Förnamn Efternamn', tel: '070-000 00 03' }
    ] },
    { namn: 'Grupp 2', veckor: [3, 7, 11, 15, 19, 23, 27, 31, 35, 39, 43, 47, 51], personal: [
      { roll: 'SL', namn: '43BB Förnamn Efternamn', tel: '070-000 00 04' },
      { roll: 'CH', namn: '4303 Förnamn Efternamn', tel: '070-000 00 05' },
      { roll: 'RD', namn: '4304 Förnamn Efternamn', tel: '070-000 00 06' }
    ] },
    { namn: 'Grupp 3', veckor: [4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52], personal: [
      { roll: 'SL', namn: '43CC Förnamn Efternamn', tel: '070-000 00 07' },
      { roll: 'CH', namn: '4305 Förnamn Efternamn', tel: '070-000 00 08' },
      { roll: 'RD', namn: '4306 Förnamn Efternamn', tel: '070-000 00 09' }
    ] },
    { namn: 'Grupp 4', veckor: [1, 5, 9, 13, 17, 21, 25, 29, 33, 37, 41, 45, 49, 53], personal: [
      { roll: 'SL', namn: '43DD Förnamn Efternamn', tel: '070-000 00 10' },
      { roll: 'CH', namn: '4307 Förnamn Efternamn', tel: '070-000 00 11' },
      { roll: 'RD', namn: '4308 Förnamn Efternamn', tel: '070-000 00 12' }
    ] },
    { namn: 'Grupp D', veckor: [], personal: [
      { roll: 'CH/SL', namn: '4309 Förnamn Efternamn', tel: '070-000 00 13' }
    ] }
  ],
  viktigaNummer: [
    { namn: 'SDC', tel: '070-000 00 90' },
    { namn: 'IT-Support', tel: '018-00 000 00' }
  ],
  storhelger: [
    { vecka: 1, namn: 'Nyår (2025/2026)' },
    { vecka: 14, namn: 'Påsk' },
    { vecka: 25, namn: 'Midsommar' },
    { vecka: 52, namn: 'Julafton' },
    { vecka: 53, namn: 'Nyår (2026/2027)' }
  ]
};
