/**
 * HomePage — pagina iniziale pubblica
 *
 * Landing page che permette l'accesso al test gratuito e presenta NorthStar.
 */

export default function Page() {
  return (
    <main className="min-h-screen bg-[#0e1018] text-white">
      {/* Hero Section */}
      <section className="px-4 py-16 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold text-[#c19e4a] mb-6">
            Scopri la tua strada con NorthStar
          </h1>
          <p className="text-xl text-gray-300 mb-8 leading-relaxed">
            La bussola digitale che ti aiuta a scegliere studi, mestieri e direzioni di vita
            con consapevolezza. Test di personalità, dati scientifici e intelligenza artificiale.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/test"
              className="bg-[#7db89a] text-[#0e1018] px-8 py-4 rounded-lg font-semibold text-lg hover:bg-[#6ba885] transition-colors"
            >
              Fai il test gratuito
            </a>
            <a
              href="/come-funziona"
              className="border border-[#7db89a] text-[#7db89a] px-8 py-4 rounded-lg font-semibold text-lg hover:bg-[#7db89a] hover:text-[#0e1018] transition-colors"
            >
              Come funziona
            </a>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 py-16 bg-[#1a1d23]">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-[#c19e4a] text-center mb-12">
            Cosa offre NorthStar
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-[#7db89a] rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🧠</span>
              </div>
              <h3 className="text-xl font-semibold text-[#7db89a] mb-2">Test di Personalità</h3>
              <p className="text-gray-300">
                Scopri il tuo profilo RIASEC con un test scientifico e validato.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-[#7db89a] rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📊</span>
              </div>
              <h3 className="text-xl font-semibold text-[#7db89a] mb-2">Dati sui Settori</h3>
              <p className="text-gray-300">
                Esplora mestieri, stipendi, prospettive di crescita per ogni settore.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-[#7db89a] rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🤖</span>
              </div>
              <h3 className="text-xl font-semibold text-[#7db89a] mb-2">AI Personalizzata</h3>
              <p className="text-gray-300">
                Raccomandazioni su misura grazie all'intelligenza artificiale.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Free vs Premium */}
      <section className="px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-[#c19e4a] text-center mb-12">
            Versione Free e Premium
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-[#1a1d23] p-8 rounded-lg">
              <h3 className="text-2xl font-semibold text-[#7db89a] mb-4">Free</h3>
              <ul className="space-y-3 text-gray-300">
                <li>✅ Test di personalità completo</li>
                <li>✅ Risultati sintetici</li>
                <li>✅ Top 3 settori consigliati</li>
                <li>✅ Salvataggio preferenze base</li>
                <li>✅ News generiche</li>
                <li>✅ Mini piano iniziale</li>
              </ul>
              <p className="text-sm text-gray-400 mt-4">
                Perfetto per iniziare il tuo percorso di orientamento
              </p>
            </div>
            <div className="bg-[#c19e4a] text-[#0e1018] p-8 rounded-lg">
              <h3 className="text-2xl font-semibold mb-4">Premium</h3>
              <ul className="space-y-3">
                <li>✅ Tutto del Free</li>
                <li>✅ Percorsi personalizzati</li>
                <li>✅ Wiki settoriale dettagliata</li>
                <li>✅ News specifiche del settore</li>
                <li>✅ Dashboard avanzata</li>
                <li>✅ Supporto prioritario</li>
              </ul>
              <a
                href="/premium"
                className="inline-block bg-[#0e1018] text-[#c19e4a] px-6 py-2 rounded font-semibold mt-4 hover:bg-[#1a1d23] transition-colors"
              >
                Scopri Premium
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-16 bg-[#1a1d23] text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-[#c19e4a] mb-6">
            Pronto a scoprire chi sei?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Inizia con il test gratuito e fai il primo passo verso il tuo futuro.
          </p>
          <a
            href="/test"
            className="bg-[#c19e4a] text-[#0e1018] px-8 py-4 rounded-lg font-semibold text-lg hover:bg-[#a8853a] transition-colors"
          >
            Inizia ora
          </a>
        </div>
      </section>
    </main>
  );
}
