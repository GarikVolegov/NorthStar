/**
 * TermsOfServicePage — Termini di servizio
 *
 * Pagina con termini di servizio per NorthStar.
 */

export default function Page() {
  return (
    <main className="min-h-screen bg-[#0e1018] text-white px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* H1 */}
        <h1 className="text-4xl font-bold text-[#c19e4a] mb-8 text-center">
          Termini di servizio
        </h1>

        {/* H2: Oggetto del servizio */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-[#7db89a] mb-4">
            Oggetto del servizio
          </h2>
          <p className="text-gray-300 leading-relaxed">
            NorthStar fornisce strumenti informativi di orientamento e crescita personale attraverso la piattaforma web. Il servizio include test di personalità, raccomandazioni di carriera, contenuti formativi e strumenti di pianificazione. NorthStar non sostituisce consulenza legale, medica, psicologica o finanziaria professionale.
          </p>
        </section>

        {/* H2: Account e registrazione */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-[#7db89a] mb-4">
            Account e registrazione
          </h2>
          <p className="text-gray-300 leading-relaxed">
            Per accedere ai servizi, è necessario creare un account fornendo un indirizzo email valido e una password sicura. L'utente è responsabile della riservatezza delle credenziali di accesso e di tutte le attività che si verificano sotto il suo account.
          </p>
        </section>

        {/* H2: Piani Free e Premium */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-[#7db89a] mb-4">
            Piani Free e Premium
          </h2>
          <p className="text-gray-300 leading-relaxed mb-4">
            NorthStar offre due piani:
          </p>
          <ul className="list-disc list-inside text-gray-300 space-y-2">
            <li><strong>Free:</strong> Accesso a test base, raccomandazioni generali, contenuti limitati, salvataggio di preferenze base.</li>
            <li><strong>Premium:</strong> Accesso completo a tutti i contenuti, raccomandazioni personalizzate, wiki dettagliate, percorsi di carriera avanzati, supporto prioritario.</li>
          </ul>
          <p className="text-gray-300 leading-relaxed mt-4">
            Il piano Free permette di esplorare la piattaforma e compiere azioni concrete, ma limita l'accesso a contenuti approfonditi.
          </p>
        </section>

        {/* H2: Pagamenti e rinnovi */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-[#7db89a] mb-4">
            Pagamenti e rinnovi
          </h2>
          <p className="text-gray-300 leading-relaxed">
            I pagamenti per il piano Premium sono processati tramite Stripe. L'abbonamento si rinnova automaticamente alla scadenza, salvo disdetta. I prezzi sono indicati in euro IVA inclusa. In caso di problemi di pagamento, l'accesso Premium può essere temporaneamente sospeso.
          </p>
        </section>

        {/* H2: Uso consentito e vietato */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-[#7db89a] mb-4">
            Uso consentito e vietato
          </h2>
          <p className="text-gray-300 leading-relaxed mb-4">
            L'utente può utilizzare la piattaforma per scopi personali di orientamento. È vietato:
          </p>
          <ul className="list-disc list-inside text-gray-300 space-y-2">
            <li>Utilizzare la piattaforma per attività illegali</li>
            <li>Condividere credenziali di accesso</li>
            <li>Estarre dati in massa o utilizzare bot</li>
            <li>Violare diritti di proprietà intellettuale</li>
            <li>Disturbare il funzionamento della piattaforma</li>
          </ul>
        </section>

        {/* H2: Proprietà intellettuale */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-[#7db89a] mb-4">
            Proprietà intellettuale
          </h2>
          <p className="text-gray-300 leading-relaxed">
            Tutti i contenuti, marchi, loghi e software della piattaforma sono di proprietà di NorthStar o dei suoi licenziatari. L'utente ottiene una licenza limitata per l'uso personale, non trasferibile e non esclusiva.
          </p>
        </section>

        {/* H2: Limitazione di responsabilità */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-[#7db89a] mb-4">
            Limitazione di responsabilità
          </h2>
          <p className="text-gray-300 leading-relaxed">
            NorthStar fornisce informazioni generali e non garantisce l'accuratezza o l'idoneità per scopi specifici. Non siamo responsabili per decisioni prese sulla base delle raccomandazioni della piattaforma. La responsabilità di NorthStar è limitata al costo dell'abbonamento pagato dall'utente.
          </p>
        </section>

        {/* H2: Legge applicabile e foro competente */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-[#7db89a] mb-4">
            Legge applicabile e foro competente
          </h2>
          <p className="text-gray-300 leading-relaxed">
            Questi termini sono regolati dalla legge italiana. Per qualsiasi controversia, il foro competente è quello di [Città], Italia.
          </p>
        </section>

        {/* Contatto */}
        <div className="text-center mt-12">
          <p className="text-gray-300">
            Per domande sui termini, contattaci a support@northstar.it
          </p>
        </div>
      </div>
    </main>
  );
}