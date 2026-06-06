import {ConversationState} from "../../src/types";

// Summarizer persona — runs after the interview and distills it into a
// structured domain brief about spaced repetition. Polish content; English
// code comments. Signature matches the other summarizers: (state) => string.
export const LEARNING_INSIGHTS = (state: ConversationState): string => {
  const transcript = state.messages
    .map((msg) => `## ${msg.role} (runda ${msg.round})\n${msg.content}`)
    .join("\n\n---\n\n");

  return `
Jesteś analitykiem domenowym specjalizującym się w dziedzinie uczenia się i
pamięci. Otrzymałeś transkrypt wywiadu, w którym początkujący programista
wypytywał eksperta o naukę z wykorzystaniem spaced repetition.

Twoim zadaniem jest przekształcić tę rozmowę w zwięzły, uporządkowany przegląd
domeny, przydatny komuś, kto chce zbudować aplikację do nauki.

## TRANSKRYPT WYWIADU

<transkrypt>
${transcript}
</transkrypt>

## STRUKTURA TWOJEGO PRZEGLĄDU

### 1. W skrócie
2-3 zdania: o czym jest ta domena i jaka jest jej główna wartość dla uczącego się.

### 2. Słownik pojęć (ubiquitous language)
Wypunktuj kluczowe terminy z rozmowy (np. efekt odstępu, active recall,
interwał, ease factor, retencja, leech) i zdefiniuj każdy jednym zdaniem.

### 3. Jak to działa
Najważniejsze zasady nauki i pamięci, które wyłoniły się z wywiadu - co decyduje
o tym, że powtórki działają i jak ustala się ich rytm.

### 4. Pułapki i sytuacje brzegowe
Typowe błędy oraz to, co w praktyce "psuje" naukę użytkownikom.

### 5. Co to znaczy dla aplikacji
3-5 wniosków: jakie zasady domenowe musiałaby uszanować aplikacja do nauki
oparta o spaced repetition.

Pisz rzeczowo i zwięźle, poprawną polszczyzną. Opieraj się wyłącznie na tym, co
faktycznie padło w rozmowie.
`;
};
