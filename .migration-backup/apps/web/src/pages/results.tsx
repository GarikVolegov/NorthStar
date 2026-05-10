/**
 * ResultsPage — risultati test
 *
 * Mostra risultati sintetici per Free, dettagliati per Premium.
 */

import { useAuth } from '@/hooks/useAuth';

export default function Page() {
  const { user } = useAuth();

  // Mock data - in realtà verrebbe dai risultati del test
  const topSectors = [
    { name: "Tecnologia", match: 85, description: "Sviluppo software, data science, cybersecurity" },
    { name: "Marketing", match: 78, description: "Digital marketing, content creation, social media" },
    { name: "Finanza", match: 72, description: "Analisi finanziaria, investment banking, fintech" }
  ];

  return (
    <main className="min-h-screen bg-[#0e1018] px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-[#c19e4a] mb-8 text-center">
          I tuoi risultati
        </h1>

        {/* Profilo RIASEC */}
        <section className="bg-[#1a1d23] p-6 rounded-lg mb-8">
          <h2 className="text-xl font-semibold text-[#7db89a] mb-4">
            Il tuo profilo RIASEC
          </h2>
          <p className="text-gray-300 mb-6">
            Basandoci sulle tue risposte, ecco i tuoi punteggi nei sei tipi di personalità professionale:
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-[#0e1018] p-4 rounded text-center">
              <div className="text-[#c19e4a] font-semibold">Realistico (R)</div>
              <div className="text-2xl font-bold text-[#7db89a]">18</div>
              <div className="text-sm text-gray-400">Lavora con cose concrete</div>
            </div>
            <div className="bg-[#0e1018] p-4 rounded text-center">
              <div className="text-[#c19e4a] font-semibold">Investigativo (I)</div>
              <div className="text-2xl font-bold text-[#7db89a]">22</div>
              <div className="text-sm text-gray-400">Risolve problemi complessi</div>
            </div>
            <div className="bg-[#0e1018] p-4 rounded text-center">
              <div className="text-[#c19e4a] font-semibold">Artistico (A)</div>
              <div className="text-2xl font-bold text-[#7db89a]">15</div>
              <div className="text-sm text-gray-400">Crea e innova</div>
            </div>
            <div className="bg-[#0e1018] p-4 rounded text-center">
              <div className="text-[#c19e4a] font-semibold">Sociale (S)</div>
              <div className="text-2xl font-bold text-[#7db89a]">12</div>
              <div className="text-sm text-gray-400">Aiuta gli altri</div>
            </div>
            <div className="bg-[#0e1018] p-4 rounded text-center">
              <div className="text-[#c19e4a] font-semibold">Imprenditoriale (E)</div>
              <div className="text-2xl font-bold text-[#7db89a]">16</div>
              <div className="text-sm text-gray-400">Gestisce e convince</div>
            </div>
            <div className="bg-[#0e1018] p-4 rounded text-center">
              <div className="text-[#c19e4a] font-semibold">Convenzionale (C)</div>
              <div className="text-2xl font-bold text-[#7db89a]">14</div>
              <div className="text-sm text-gray-400">Organizza dati</div>
            </div>
          </div>
        </section>

        {/* Settori consigliati */}
        <section className="bg-[#1a1d23] p-6 rounded-lg mb-8">
          <h2 className="text-xl font-semibold text-[#7db89a] mb-4">
            Settori che ti consigliamo
          </h2>
          <div className="space-y-4">
            {topSectors.map((sector, index) => (
              <div key={sector.name} className="bg-[#0e1018] p-4 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-semibold text-[#c19e4a]">
                    {index + 1}. {sector.name}
                  </h3>
                  <span className="bg-[#7db89a] text-[#0e1018] px-3 py-1 rounded-full text-sm font-semibold">
                    {sector.match}% match
                  </span>
                </div>
                <p className="text-gray-300 text-sm mb-3">{sector.description}</p>
                <div className="flex gap-2">
                  <a
                    href={`/settore/${sector.name.toLowerCase()}`}
                    className="text-[#7db89a] hover:text-[#6ba885] text-sm font-medium"
                  >
                    Scopri di più →
                  </a>
                  {user?.isPremium && (
                    <span className="text-[#c19e4a] text-sm">• News settoriali disponibili</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Call to action */}
        <section className="text-center">
          {user?.isPremium ? (
            <div className="space-y-4">
              <a
                href="/dashboard"
                className="inline-block bg-[#c19e4a] text-[#0e1018] px-8 py-4 rounded-lg font-semibold hover:bg-[#a8853a] transition-colors"
              >
                Vai alla tua Dashboard Premium
              </a>
              <p className="text-gray-400">
                Accedi a percorsi personalizzati, wiki dettagliate e molto altro
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <a
                href="/dashboard"
                className="inline-block bg-[#7db89a] text-[#0e1018] px-8 py-4 rounded-lg font-semibold hover:bg-[#6ba885] transition-colors"
              >
                Salva i risultati (Free)
              </a>
              <div className="bg-[#c19e4a] text-[#0e1018] p-6 rounded-lg inline-block">
                <h3 className="font-semibold mb-2">Vuoi di più?</h3>
                <p className="mb-3">Con Premium ottieni analisi approfondite e percorsi personalizzati</p>
                <a
                  href="/premium"
                  className="bg-[#0e1018] text-[#c19e4a] px-4 py-2 rounded font-semibold hover:bg-[#1a1d23] transition-colors"
                >
                  Scopri Premium
                </a>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
