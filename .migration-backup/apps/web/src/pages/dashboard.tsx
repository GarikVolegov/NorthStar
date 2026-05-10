/**
 * DashboardPage — dashboard autenticato
 *
 * Mostra contenuti diversi per Free e Premium.
 * Free: riepilogo base, azioni limitate.
 * Premium: dashboard completo con percorsi, obiettivi, etc.
 */

import { useAuth } from '@/hooks/useAuth';

export default function Page() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <main className="min-h-screen bg-[#0e1018] px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-[#c19e4a] mb-8">
          Dashboard di {user.name}
        </h1>

        {user.isPremium ? (
          <PremiumDashboard />
        ) : (
          <FreeDashboard />
        )}
      </div>
    </main>
  );
}

function FreeDashboard() {
  return (
    <div className="space-y-6">
      <section className="bg-[#1a1d23] p-6 rounded-lg">
        <h2 className="text-xl font-semibold text-[#7db89a] mb-4">Il tuo profilo base</h2>
        <p className="text-gray-300 mb-4">
          Hai completato il test di personalità. Ecco un riepilogo delle tue preferenze salvate.
        </p>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-[#0e1018] p-4 rounded">
            <h3 className="font-medium text-[#c19e4a]">Settori preferiti</h3>
            <p className="text-sm text-gray-400">Tecnologia, Marketing</p>
          </div>
          <div className="bg-[#0e1018] p-4 rounded">
            <h3 className="font-medium text-[#c19e4a]">Obiettivi</h3>
            <p className="text-sm text-gray-400">Crescita professionale</p>
          </div>
          <div className="bg-[#0e1018] p-4 rounded">
            <h3 className="font-medium text-[#c19e4a]">News salvate</h3>
            <p className="text-sm text-gray-400">3 articoli</p>
          </div>
        </div>
      </section>

      <section className="bg-[#1a1d23] p-6 rounded-lg">
        <h2 className="text-xl font-semibold text-[#7db89a] mb-4">Azioni disponibili</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <a
            href="/test"
            className="block bg-[#7db89a] text-[#0e1018] p-4 rounded-lg hover:bg-[#6ba885] transition-colors"
          >
            <h3 className="font-semibold">Aggiorna test</h3>
            <p className="text-sm">Rifai il test per aggiornare le tue preferenze</p>
          </a>
          <a
            href="/settori"
            className="block bg-[#7db89a] text-[#0e1018] p-4 rounded-lg hover:bg-[#6ba885] transition-colors"
          >
            <h3 className="font-semibold">Esplora settori</h3>
            <p className="text-sm">Scopri di più sui settori che ti interessano</p>
          </a>
        </div>
      </section>

      <section className="bg-[#c19e4a] text-[#0e1018] p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Sblocca il Premium</h2>
        <p className="mb-4">
          Con NorthStar Premium ottieni percorsi personalizzati, wiki dettagliate, news settoriali e molto altro.
        </p>
        <a
          href="/premium"
          className="inline-block bg-[#0e1018] text-[#c19e4a] px-6 py-2 rounded font-semibold hover:bg-[#1a1d23] transition-colors"
        >
          Scopri Premium
        </a>
      </section>
    </div>
  );
}

function PremiumDashboard() {
  return (
    <div className="space-y-6">
      <section className="bg-[#1a1d23] p-6 rounded-lg">
        <h2 className="text-xl font-semibold text-[#7db89a] mb-4">Il tuo percorso personalizzato</h2>
        <p className="text-gray-300 mb-4">
          Benvenuto nel tuo dashboard Premium! Qui trovi tutti gli strumenti per la tua crescita.
        </p>
        <div className="grid md:grid-cols-4 gap-4">
          <div className="bg-[#0e1018] p-4 rounded text-center">
            <h3 className="font-medium text-[#c19e4a]">Test completato</h3>
            <p className="text-2xl font-bold text-[#7db89a]">RIASEC</p>
          </div>
          <div className="bg-[#0e1018] p-4 rounded text-center">
            <h3 className="font-medium text-[#c19e4a]">Settore scelto</h3>
            <p className="text-2xl font-bold text-[#7db89a]">Tech</p>
          </div>
          <div className="bg-[#0e1018] p-4 rounded text-center">
            <h3 className="font-medium text-[#c19e4a]">Obiettivi attivi</h3>
            <p className="text-2xl font-bold text-[#7db89a]">5</p>
          </div>
          <div className="bg-[#0e1018] p-4 rounded text-center">
            <h3 className="font-medium text-[#c19e4a]">Progresso</h3>
            <p className="text-2xl font-bold text-[#7db89a]">75%</p>
          </div>
        </div>
      </section>

      <section className="bg-[#1a1d23] p-6 rounded-lg">
        <h2 className="text-xl font-semibold text-[#7db89a] mb-4">Strumenti Premium</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <a
            href="/percorso"
            className="block bg-[#c19e4a] text-[#0e1018] p-4 rounded-lg hover:bg-[#a8853a] transition-colors"
          >
            <h3 className="font-semibold">Percorso carriera</h3>
            <p className="text-sm">Visualizza il tuo roadmap personalizzato</p>
          </a>
          <a
            href="/wiki"
            className="block bg-[#c19e4a] text-[#0e1018] p-4 rounded-lg hover:bg-[#a8853a] transition-colors"
          >
            <h3 className="font-semibold">Wiki settoriale</h3>
            <p className="text-sm">Accedi alla conoscenza approfondita</p>
          </a>
          <a
            href="/news"
            className="block bg-[#c19e4a] text-[#0e1018] p-4 rounded-lg hover:bg-[#a8853a] transition-colors"
          >
            <h3 className="font-semibold">News settoriali</h3>
            <p className="text-sm">Articoli specifici per il tuo settore</p>
          </a>
        </div>
      </section>

      <section className="bg-[#1a1d23] p-6 rounded-lg">
        <h2 className="text-xl font-semibold text-[#7db89a] mb-4">Obiettivi recenti</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-[#0e1018] p-3 rounded">
            <span className="text-gray-300">Completare corso online di React</span>
            <span className="text-[#7db89a] font-medium">In corso</span>
          </div>
          <div className="flex items-center justify-between bg-[#0e1018] p-3 rounded">
            <span className="text-gray-300">Partecipare a meetup tech</span>
            <span className="text-[#c19e4a] font-medium">Completato</span>
          </div>
        </div>
      </section>
    </div>
  );
}
