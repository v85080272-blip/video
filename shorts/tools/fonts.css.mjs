const CYR = 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116';
const LAT = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const face = (fam, file, w) => ['cyrillic', 'latin'].map(s =>
  `@font-face{font-family:'${fam}';font-weight:${w};font-display:block;src:url(assets/${file}-${s}-${w}-normal.woff2) format('woff2');unicode-range:${s === 'cyrillic' ? CYR : LAT}}`).join('\n');
export const fontsCss = ["@font-face{font-family:'Noto Color Emoji';font-display:block;src:url(assets/NotoColorEmoji.ttf) format('truetype')}", face('Rubik', 'rubik', 700), face('Rubik', 'rubik', 900), face('Unbounded', 'unbounded', 900)].join('\n');
