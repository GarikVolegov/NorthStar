/**
 * ChiSiamoPage — chi siamo
 *
 * Pagina completa con contenuto SEO-ottimizzato per NorthStar.
 */

export default function Page() {
  return (
    <main className="min-h-screen bg-[#0e1018] text-white px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* H1 */}
        <h1 className="text-4xl font-bold text-[#c19e4a] mb-8 text-center">
          Chi siamo
        </h1>

        {/* H2: Cosa facciamo */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-[#7db89a] mb-4">
            Cosa facciamo
          </h2>
          <p className="text-gray-300 leading-relaxed">
            NorthStar è una bussola digitale che aiuta giovani e adulti a scegliere con maggiore consapevolezza studi, mestieri e direzioni di vita. La piattaforma unisce test di personalità, dati su settori e mestieri, contenuti formativi e strumenti di organizzazione personale.
          </p>
        </section>

        {/* H2: Perché esistiamo */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-[#7db89a] mb-4">
            Perché esistiamo
          </h2>
          <p className="text-gray-300 leading-relaxed">
            Crediamo che ogni persona abbia un potenziale unico e che la chiave per realizzarlo sia trovare la strada giusta. Nel mondo complesso di oggi, con infinite possibilità e pressioni esterne, NorthStar offre chiarezza e direzione basata su dati scientifici e intelligenza artificiale.
          </p>
        </section>

        {/* H2: Il nostro metodo */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-[#7db89a] mb-4">
            Il nostro metodo
          </h2>
          <p className="text-gray-300 leading-relaxed mb-4">
            Il nostro approccio combina:
          </p>
          <ul className="list-disc list-inside text-gray-300 space-y-2">
            <li>Test di personalità RIASEC scientificamente validati</li>
            <li>Database aggiornato di settori e professioni</li>
            <li>Intelligenza artificiale per raccomandazioni personalizzate</li>
            <li>Contenuti formativi e strumenti di pianificazione</li>
            <li>Community e supporto continuo</li>
          </ul>
        </section>

        {/* H2: A chi ci rivolgiamo */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-[#7db89a] mb-4">
            A chi ci rivolgiamo
          </h2>
          <p className="text-gray-300 leading-relaxed">
            NorthStar è pensato per studenti delle scuole superiori che devono scegliere l'università, giovani adulti in transizione di carriera, professionisti che vogliono riconvertirsi, e chiunque cerchi maggiore chiarezza sul proprio futuro professionale. Siamo accessibili a tutti, indipendentemente dall'età o dal background.
          </p>
        </section>

        {/* H2: I nostri valori */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-[#7db89a] mb-4">
            I nostri valori
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-[#c19e4a] mb-2">Trasparenza</h3>
              <p className="text-gray-300">Forniamo dati chiari e fonti verificabili per ogni raccomandazione.</p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-[#c19e4a] mb-2">Personalizzazione</h3>
              <p className="text-gray-300">Ogni percorso è unico e costruito sulle caratteristiche individuali.</p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-[#c19e4a] mb-2">Accessibilità</h3>
              <p className="text-gray-300">Rendiamo gli strumenti di orientamento disponibili a tutti, gratuitamente nella versione base.</p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-[#c19e4a] mb-2">Innovazione</h3>
              <p className="text-gray-300">Utilizziamo le più recenti tecnologie AI per migliorare l'esperienza utente.</p>
            </div>
          </div>
        </section>

        {/* Call to action */}
        <div className="text-center mt-12">
          <p className="text-gray-300 mb-4">
            Pronto a scoprire la tua strada? Inizia con il nostro test di personalità gratuito.
          </p>
          <a
            href="/test"
            className="inline-block bg-[#c19e4a] text-[#0e1018] px-8 py-3 rounded-lg font-semibold hover:bg-[#a8853a] transition-colors"
          >
            Fai il test gratuito
          </a>
        </div>
      </div>
    </main>
  );
}
