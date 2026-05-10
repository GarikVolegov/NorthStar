/**
 * PrivacyPolicyPage — Privacy Policy
 *
 * Pagina con policy privacy GDPR-compliant per NorthStar.
 */

export default function Page() {
  return (
    <main className="min-h-screen bg-[#0e1018] text-white px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* H1 */}
        <h1 className="text-4xl font-bold text-[#c19e4a] mb-8 text-center">
          Privacy Policy
        </h1>

        {/* H2: Titolare del trattamento */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-[#7db89a] mb-4">
            Titolare del trattamento
          </h2>
          <p className="text-gray-300 leading-relaxed">
            Il titolare del trattamento dei dati personali è NorthStar Srl, con sede legale in [Indirizzo], Italia. Per qualsiasi domanda relativa alla privacy, contattaci all'indirizzo email: privacy@northstar.it.
          </p>
        </section>

        {/* H2: Tipologie di dati raccolti */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-[#7db89a] mb-4">
            Tipologie di dati raccolti
          </h2>
          <p className="text-gray-300 leading-relaxed mb-4">
            Raccogliamo i seguenti tipi di dati personali:
          </p>
          <ul className="list-disc list-inside text-gray-300 space-y-2">
            <li>Dati forniti direttamente dall'utente: nome, email, risposte ai test di personalità</li>
            <li>Dati di navigazione: indirizzo IP, tipo di browser, pagine visitate</li>
            <li>Dati di utilizzo: interazioni con la piattaforma, preferenze salvate</li>
            <li>Dati di pagamento (solo per utenti Premium): informazioni di fatturazione</li>
          </ul>
        </section>

        {/* H2: Finalità e basi giuridiche */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-[#7db89a] mb-4">
            Finalità e basi giuridiche
          </h2>
          <p className="text-gray-300 leading-relaxed mb-4">
            Trattiamo i dati personali per le seguenti finalità:
          </p>
          <ul className="list-disc list-inside text-gray-300 space-y-2">
            <li>Fornire i servizi della piattaforma (base giuridica: esecuzione del contratto)</li>
            <li>Migliorare l'esperienza utente e personalizzare i contenuti (base giuridica: legittimo interesse)</li>
            <li>Inviare comunicazioni di servizio e aggiornamenti (base giuridica: esecuzione del contratto)</li>
            <li>Marketing diretto, previo consenso (base giuridica: consenso)</li>
            <li>Adempiere obblighi legali (base giuridica: obbligo legale)</li>
          </ul>
        </section>

        {/* H2: Cookie e tecnologie simili */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-[#7db89a] mb-4">
            Cookie e tecnologie simili
          </h2>
          <p className="text-gray-300 leading-relaxed">
            Utilizziamo cookie tecnici necessari per il funzionamento della piattaforma e cookie analitici per migliorare il servizio. Per cookie di marketing, richiediamo il consenso preventivo. Puoi gestire le preferenze cookie nelle impostazioni del tuo browser.
          </p>
        </section>

        {/* H2: Modalità e tempi di conservazione */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-[#7db89a] mb-4">
            Modalità e tempi di conservazione
          </h2>
          <p className="text-gray-300 leading-relaxed">
            I dati sono conservati in server sicuri ubicati in Italia e nell'Unione Europea. I dati personali sono conservati per il tempo necessario alle finalità per cui sono stati raccolti, e comunque non oltre 10 anni dall'ultimo utilizzo del servizio, salvo obblighi legali diversi.
          </p>
        </section>

        {/* H2: Destinatari dei dati */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-[#7db89a] mb-4">
            Destinatari dei dati
          </h2>
          <p className="text-gray-300 leading-relaxed">
            I dati possono essere comunicati a fornitori di servizi tecnici (hosting, analytics), autorità giudiziarie in caso di obblighi legali, e partner commerciali previo consenso. Non vendiamo dati personali a terzi.
          </p>
        </section>

        {/* H2: Diritti dell'utente */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-[#7db89a] mb-4">
            Diritti dell'utente
          </h2>
          <p className="text-gray-300 leading-relaxed mb-4">
            Ai sensi del GDPR, hai diritto a:
          </p>
          <ul className="list-disc list-inside text-gray-300 space-y-2">
            <li>Accedere ai tuoi dati personali</li>
            <li>Correggere dati inesatti</li>
            <li>Cancellare i tuoi dati (diritto all'oblio)</li>
            <li>Limitare il trattamento</li>
            <li>Portabilità dei dati</li>
            <li>Opporti al trattamento per marketing</li>
            <li>Revocare il consenso</li>
          </ul>
          <p className="text-gray-300 leading-relaxed mt-4">
            Per esercitare questi diritti, contattaci a privacy@northstar.it.
          </p>
        </section>

        {/* H2: Aggiornamenti della policy */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-[#7db89a] mb-4">
            Aggiornamenti della policy
          </h2>
          <p className="text-gray-300 leading-relaxed">
            Questa privacy policy può essere aggiornata periodicamente. Le modifiche significative saranno comunicate via email o notifica in app. L'ultima versione è sempre disponibile su questa pagina.
          </p>
          <p className="text-gray-300 leading-relaxed mt-2">
            Ultimo aggiornamento: [Data corrente]
          </p>
        </section>
      </div>
    </main>
  );
}