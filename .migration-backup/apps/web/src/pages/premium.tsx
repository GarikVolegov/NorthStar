/**
 * PremiumPage — upgrade premium
 *
 * Presenta i vantaggi del piano Premium e permette l'upgrade.
 */

import { useAuth } from '@/hooks/useAuth';

export default function Page() {
  const { user } = useAuth();

  if (user?.isPremium) {
    return (
      <main className="min-h-screen bg-[#0e1018] flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-[#c19e4a] mb-4">
            Sei già Premium! 🎉
          </h1>
          <p className="text-gray-300 mb-6">
            Goditi tutti i vantaggi del piano Premium.
          </p>
          <a
            href="/dashboard"
            className="bg-[#c19e4a] text-[#0e1018] px-6 py-3 rounded-lg font-semibold hover:bg-[#a8853a] transition-colors"
          >
            Vai alla Dashboard
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0e1018] px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-[#c19e4a] mb-4">
            NorthStar Premium
          </h1>
          <p className="text-xl text-gray-300">
            Sblocca il tuo potenziale con strumenti avanzati di orientamento
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <div className="bg-[#1a1d23] p-6 rounded-lg">
            <div className="w-12 h-12 bg-[#c19e4a] rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl">🎯</span>
            </div>
            <h3 className="text-lg font-semibold text-[#c19e4a] mb-2">
              Percorsi Personalizzati
            </h3>
            <p className="text-gray-300 text-sm">
              Roadmap di carriera su misura basati sui tuoi risultati RIASEC
            </p>
          </div>

          <div className="bg-[#1a1d23] p-6 rounded-lg">
            <div className="w-12 h-12 bg-[#c19e4a] rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl">📚</span>
            </div>
            <h3 className="text-lg font-semibold text-[#c19e4a] mb-2">
              Wiki Settoriale
            </h3>
            <p className="text-gray-300 text-sm">
              Conoscenza approfondita sui settori che ti interessano
            </p>
          </div>

          <div className="bg-[#1a1d23] p-6 rounded-lg">
            <div className="w-12 h-12 bg-[#c19e4a] rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl">📰</span>
            </div>
            <h3 className="text-lg font-semibold text-[#c19e4a] mb-2">
              News Settoriali
            </h3>
            <p className="text-gray-300 text-sm">
              Aggiornamenti specifici sui trend del tuo settore
            </p>
          </div>

          <div className="bg-[#1a1d23] p-6 rounded-lg">
            <div className="w-12 h-12 bg-[#c19e4a] rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl">📊</span>
            </div>
            <h3 className="text-lg font-semibold text-[#c19e4a] mb-2">
              Dashboard Avanzata
            </h3>
            <p className="text-gray-300 text-sm">
              Monitora progressi, obiettivi e statistiche dettagliate
            </p>
          </div>

          <div className="bg-[#1a1d23] p-6 rounded-lg">
            <div className="w-12 h-12 bg-[#c19e4a] rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl">🤖</span>
            </div>
            <h3 className="text-lg font-semibold text-[#c19e4a] mb-2">
              AI Coach
            </h3>
            <p className="text-gray-300 text-sm">
              Assistente virtuale per consigli personalizzati
            </p>
          </div>

          <div className="bg-[#1a1d23] p-6 rounded-lg">
            <div className="w-12 h-12 bg-[#c19e4a] rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl">⭐</span>
            </div>
            <h3 className="text-lg font-semibold text-[#c19e4a] mb-2">
              Supporto Prioritario
            </h3>
            <p className="text-gray-300 text-sm">
              Assistenza rapida e risposte alle tue domande
            </p>
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-[#c19e4a] text-[#0e1018] p-8 rounded-lg text-center mb-8">
          <h2 className="text-2xl font-bold mb-4">Abbonamento Mensile</h2>
          <div className="text-4xl font-bold mb-2">€9.99/mese</div>
          <p className="text-sm opacity-80">Fatturazione mensile, cancella quando vuoi</p>
        </div>

        {/* CTA */}
        <div className="text-center">
          <p className="text-gray-300 mb-6">
            Inizia la tua trasformazione professionale oggi stesso
          </p>
          <button className="bg-[#c19e4a] text-[#0e1018] px-8 py-4 rounded-lg font-semibold text-lg hover:bg-[#a8853a] transition-colors">
            Attiva Premium
          </button>
          <p className="text-sm text-gray-400 mt-4">
            Prova gratuita per 7 giorni, poi €9.99/mese
          </p>
        </div>

        {/* FAQ */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-[#c19e4a] mb-6 text-center">
            Domande frequenti
          </h2>
          <div className="space-y-4">
            <div className="bg-[#1a1d23] p-4 rounded-lg">
              <h3 className="font-semibold text-[#7db89a] mb-2">
                Posso cancellare in qualsiasi momento?
              </h3>
              <p className="text-gray-300 text-sm">
                Sì, puoi cancellare il tuo abbonamento in qualsiasi momento senza penali.
              </p>
            </div>
            <div className="bg-[#1a1d23] p-4 rounded-lg">
              <h3 className="font-semibold text-[#7db89a] mb-2">
                Cosa succede ai miei dati se cancello?
              </h3>
              <p className="text-gray-300 text-sm">
                I tuoi dati rimangono salvati, ma alcune funzionalità Premium diventano limitate.
              </p>
            </div>
            <div className="bg-[#1a1d23] p-4 rounded-lg">
              <h3 className="font-semibold text-[#7db89a] mb-2">
                È sicuro il pagamento?
              </h3>
              <p className="text-gray-300 text-sm">
                Utilizziamo Stripe per i pagamenti, con crittografia SSL e conformità PCI.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
