# Istruzioni Replit Agent per NorthStar - Feature Prioritarie

## 1. Profilo Utente Avanzato (Priorità Alta)
- Implementa upload avatar: Aggiungi input file in Profile.tsx, salva su /public/avatars/[userId].jpg
- Barra completamento: Calcola % basato su campi compilati (nome, bio, RIASEC, obiettivi), mostra in ProfileHeader
- Pseudo-codice React:
```tsx
const [completion, setCompletion] = useState(0);
useEffect(() => {
  const fields = [name, bio, riasec, goals];
  setCompletion((fields.filter(Boolean).length / 4) * 100);
}, [fields]);
<ProgressBar percent={completion} color="#4F46E5" />
```
- Badge/Streak: Usa localStorage per streak daily, mostra icone SVG

## 2. Kanban Candidature (Priorità Media)
- Crea KanbanBoard.tsx con drag-drop (react-beautiful-dnd)
- Colonne: Applicata, In Attesa, Intervista, Offerta
- Template AI: Button "Genera Lettera" -> POST /api/ai-letter con jobDesc + profile
- Pseudo-codice:
```tsx
<DragDropContext onDragEnd={handleDrag}>
  <Droppable droppableId="applicata"><CardList cards={applications} /></Droppable>
</DragDropContext>
```

## 3. Gamification & Feed
- Streak: Cron job daily check login, update DB streak
- Feed amici: Query users opt-in, mostra "UtenteX completato test" con like/share

## Deploy & Test
- Test responsive mobile-first
- A/B: Usa Vercel flags per % utenti con nuova UI
- Commit: "feat(profile): advanced avatar + completion bar"

Priorità: 1 -> 2 -> 3. Pinga se blocchi su Vercel/Replit.