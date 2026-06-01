/**
 * /bussola — la casa dell'utente indeciso (pagina).
 * Il corpo vive in <BussolaHome/>, condiviso col dashboard (dashboard e Bussola
 * unificati: stessa esperienza, una sola fonte di verità = lo stage).
 */
import { BussolaHome } from "@/features/compass/BussolaHome";

export default function BussolaPage() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <BussolaHome />
    </div>
  );
}
