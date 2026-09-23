// A tongue-in-cheek "as seen nowhere" logo bar -- purely decorative, no
// affiliation with any company shown. Grayscale by default, full color on
// hover, sized uniformly via CSS regardless of each logo's native aspect
// ratio so a tall icon (Tesla) and a wide wordmark (Amazon) sit at the
// same visual weight in the row.
export default function LogoStrip({ eyebrow, note, logos }) {
  const base = import.meta.env.BASE_URL
  return (
    <div className="logo-strip">
      <div className="logo-strip-eyebrow">{eyebrow}</div>
      <div className="logo-strip-row">
        {logos.map((l) => (
          <img
            key={l.file}
            className="logo-strip-item"
            src={`${base}${l.file}`}
            alt={l.name}
            title={l.name}
            loading="lazy"
          />
        ))}
      </div>
      {note && <p className="logo-strip-note">{note}</p>}
    </div>
  )
}
