import { useEffect } from "react";

export function useCvPrintStyle() {
  useEffect(() => {
    const style = document.createElement("style");
    style.id = "cv-print-style";
    style.textContent = `
      @media print {
        body > *:not(#cv-print-portal) { display: none !important; }
        #cv-print-portal { position: fixed; top: 0; left: 0; width: 100%; z-index: 99999; }
        #cv-print-portal > * { display: none !important; }
        #cv-print-portal #cv-preview-scroll { display: block !important; overflow: visible !important; padding: 0 !important; }
        #cv-document { box-shadow: none !important; margin: 0 !important; width: 100% !important; }
        @page { margin: 0; size: A4; }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.getElementById("cv-print-style")?.remove();
    };
  }, []);
}
