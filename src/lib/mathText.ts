// Formules dans le texte des flashcards : $…$, $$…$$, \(…\), \[…\]. Une formule peut tenir sur plusieurs lignes
// (ex. \begin{cases} … \end{cases}) : ses retours à la ligne ne doivent pas devenir des sauts de ligne HTML.
const MATH = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$]+?\$)/g;

// Retours à la ligne tapés au clavier → <br>, sauf à l'intérieur des formules
export function newlinesToBr(text: string) {
  return text
    .split(MATH)
    .map((part, i) => (i % 2 ? part : part.replace(/\n/g, '<br>')))
    .join('');
}
