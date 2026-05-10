/**
 * TestPage — test RIASEC
 *
 * Test di personalità semplificato per versione Free.
 * In Premium potrebbe essere più dettagliato.
 */

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

const questions = [
  {
    id: 1,
    question: "Mi piace lavorare con dati e numeri",
    type: "realistic"
  },
  {
    id: 2,
    question: "Preferisco aiutare gli altri e insegnare",
    type: "social"
  },
  {
    id: 3,
    question: "Mi interessa creare cose nuove e artistiche",
    type: "artistic"
  },
  {
    id: 4,
    question: "Voglio organizzare e gestire progetti",
    type: "enterprising"
  },
  {
    id: 5,
    question: "Mi piace risolvere problemi scientifici",
    type: "investigative"
  },
  // Aggiungi più domande per un test completo
];

export default function Page() {
  const { user } = useAuth();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [completed, setCompleted] = useState(false);

  const handleAnswer = (questionId: number, value: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      setCompleted(true);
    }
  };

  const calculateResult = () => {
    // Calcolo semplificato dei punteggi RIASEC
    const scores = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };

    Object.entries(answers).forEach(([qId, value]) => {
      const question = questions.find(q => q.id === parseInt(qId));
      if (question) {
        const type = question.type;
        if (type === 'realistic') scores.R += value;
        else if (type === 'investigative') scores.I += value;
        else if (type === 'artistic') scores.A += value;
        else if (type === 'social') scores.S += value;
        else if (type === 'enterprising') scores.E += value;
      }
    });

    return scores;
  };

  if (completed) {
    const scores = calculateResult();
    const topTypes = Object.entries(scores)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([type]) => type);

    return (
      <main className="min-h-screen bg-[#0e1018] px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-bold text-[#c19e4a] mb-8">
            Risultati del Test
          </h1>
          <div className="bg-[#1a1d23] p-6 rounded-lg mb-6">
            <h2 className="text-xl font-semibold text-[#7db89a] mb-4">
              I tuoi tipi principali: {topTypes.join(', ')}
            </h2>
            <p className="text-gray-300 mb-4">
              Basandoci sulle tue risposte, ecco i tuoi punteggi:
            </p>
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(scores).map(([type, score]) => (
                <div key={type} className="bg-[#0e1018] p-3 rounded">
                  <div className="text-[#c19e4a] font-semibold">{type}</div>
                  <div className="text-2xl font-bold text-[#7db89a]">{score}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <a
              href="/risultati"
              className="block bg-[#7db89a] text-[#0e1018] px-6 py-3 rounded-lg font-semibold hover:bg-[#6ba885] transition-colors"
            >
              Vedi risultati dettagliati
            </a>
            {user?.isPremium ? (
              <a
                href="/dashboard"
                className="block border border-[#c19e4a] text-[#c19e4a] px-6 py-3 rounded-lg font-semibold hover:bg-[#c19e4a] hover:text-[#0e1018] transition-colors"
              >
                Vai alla Dashboard Premium
              </a>
            ) : (
              <a
                href="/dashboard"
                className="block border border-[#7db89a] text-[#7db89a] px-6 py-3 rounded-lg font-semibold hover:bg-[#7db89a] hover:text-[#0e1018] transition-colors"
              >
                Vai alla Dashboard Free
              </a>
            )}
          </div>
        </div>
      </main>
    );
  }

  const question = questions[currentQuestion];

  return (
    <main className="min-h-screen bg-[#0e1018] px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>Domanda {currentQuestion + 1} di {questions.length}</span>
            <span>{Math.round(((currentQuestion + 1) / questions.length) * 100)}%</span>
          </div>
          <div className="w-full bg-[#1a1d23] rounded-full h-2">
            <div
              className="bg-[#7db89a] h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-[#1a1d23] p-8 rounded-lg">
          <h1 className="text-2xl font-bold text-[#c19e4a] mb-6 text-center">
            Test di Personalità RIASEC
          </h1>
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-[#7db89a] mb-4">
              {question.question}
            </h2>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(value => (
                <button
                  key={value}
                  onClick={() => handleAnswer(question.id, value)}
                  className="w-full text-left bg-[#0e1018] hover:bg-[#2a2d33] p-4 rounded-lg transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">
                      {value === 1 && "Per niente d'accordo"}
                      {value === 2 && "Poco d'accordo"}
                      {value === 3 && "Neutro"}
                      {value === 4 && "Abbastanza d'accordo"}
                      {value === 5 && "Completamente d'accordo"}
                    </span>
                    <span className="text-[#7db89a] font-semibold">{value}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
