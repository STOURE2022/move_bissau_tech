/**
 * Bandeau tricolore signature MoveBissau — couleurs du drapeau de la
 * Guinée-Bissau (rouge, jaune, vert). Utilisé comme accent visuel
 * cohérent sur les pages welcome / login / inscription.
 */
export default function FlagStripe({ className = '' }) {
  return (
    <div className={`flex h-1 rounded-full overflow-hidden ${className}`}>
      <div className="flex-1 bg-[#CE1126]" />
      <div className="flex-1 bg-[#FCD116]" />
      <div className="flex-[2] bg-[#009739]" />
    </div>
  );
}
