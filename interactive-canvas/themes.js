/* ============================================================
   themes.js — Curated YouTube VJ loop themes for Easy Projection
   ============================================================
   Easy to self-administer: just edit the video IDs and titles
   below. No need to touch any other file.

   How to find a YouTube video ID:
     URL: https://www.youtube.com/watch?v=XXXXXXXXXXX
     ID is the part after v=  (11 characters, e.g. "dQw4w9WgXcQ")

   Each theme needs exactly 9 videos for a 3×3 grid.
   Title max ~22 chars — shown under the thumbnail.
   ============================================================ */

const CANVAS_THEMES = [
  {
    id: 'halloween',
    label: '🎃 Halloween',
    videos: [
      { id: 'BFnSoONPUqs', title: 'Dark Smoke Loop' },
      { id: 'u9Dg-g7t2l4', title: 'Spiderweb Glow' },
      { id: 'FPcBGFoUKy0', title: 'Pumpkin Fire' },
      { id: 'P_4PYUE3ZRg', title: 'Ghost Particles' },
      { id: 'lTRiuFIWV54', title: 'Bats Flying' },
      { id: 'mGNCf-BQ6KA', title: 'Graveyard Mist' },
      { id: 'YPGm7JPNwkg', title: 'Skull Loop' },
      { id: 'Hs2dDG5dGkQ', title: 'Creepy Glow' },
      { id: 'K7KVFpUWkb0', title: 'Orange Fire' },
    ],
  },
  {
    id: 'christmas',
    label: '🎄 Christmas',
    videos: [
      { id: 'dIH7QLmjCN8', title: 'Snowflakes Fall' },
      { id: 'Wz9vMOb-d98', title: 'Xmas Lights' },
      { id: '3_BUTt9xjQI', title: 'Snow Particles' },
      { id: 'TbCovN9MXEI', title: 'Xmas Tree Loop' },
      { id: 'qIGa2BNTEoE', title: 'Bokeh Lights' },
      { id: 'KbFz5HbDUFQ', title: 'Winter Blizzard' },
      { id: 'KBf8SvfBW8o', title: 'Gold Sparkles' },
      { id: 'H7HgAkbBMqI', title: 'Holiday Glow' },
      { id: 'mBJ7OqkLLZ8', title: 'Glitter Loop' },
    ],
  },
  {
    id: 'easter',
    label: '🌸 Easter / Spring',
    videos: [
      { id: '3YkEUpnM9oY', title: 'Flowers Bloom' },
      { id: 'kHs-gjxqLRw', title: 'Petals Falling' },
      { id: 'nVSZMBWJTg8', title: 'Easter Eggs' },
      { id: 'bJb4Uke7rMg', title: 'Pastel Bubbles' },
      { id: 'WVb0V8DKN4E', title: 'Butterfly Loop' },
      { id: 'Hx4Sp4Gf7pU', title: 'Cherry Blossom' },
      { id: 'jnRpPxFb1Ys', title: 'Spring Nature' },
      { id: '0jZKu2BbSn4', title: 'Flower Confetti' },
      { id: 'UaV0DvMo85Q', title: 'Pastel Waves' },
    ],
  },
  {
    id: 'abstract',
    label: '✨ Abstract',
    videos: [
      { id: 'MkNeIUgNPQ8', title: 'Neon Particles' },
      { id: 'GfWFbPJ1tbU', title: 'Neon Lines' },
      { id: 'cBmVMkiHoIM', title: 'Fluid Motion' },
      { id: 'vHIGMdBvgEk', title: 'Kaleidoscope' },
      { id: 'fJ9rUzIMcZQ', title: 'Abstract Glow' },
      { id: 'WRmJZJgIWjU', title: 'RGB Warp' },
      { id: 'M7lc1UVf-VE', title: 'Color Waves' },
      { id: 'ehWnT5eJNp0', title: 'Tunnel Loop' },
      { id: 'fLeJJPxua3E', title: 'Fractal Flow' },
    ],
  },
  {
    id: 'nature',
    label: '🌿 Nature / Chill',
    videos: [
      { id: 'r9L8KMHdRaE', title: 'Forest Canopy' },
      { id: 'ZOZOtHLfLcE', title: 'Ocean Waves' },
      { id: 'PuDVzBc-rmc', title: 'Waterfall' },
      { id: 'HKqV0y6J31U', title: 'Starry Sky' },
      { id: 'g8Y-vRLx5EM', title: 'Firefly Night' },
      { id: 'lxrk9jSBEA4', title: 'Mountain Sunset' },
      { id: 'sSLFEVKO5AM', title: 'Rain Drops' },
      { id: 'V3wTNEjEIGo', title: 'Flowing River' },
      { id: 'HOGHiNz0pr8', title: 'Cloud Timelapse' },
    ],
  },
];
