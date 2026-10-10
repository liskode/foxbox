// Petit histogramme par compétence (professeur et élève)
import { masteryOf, type Competence } from '../lib/competences';

// Petit histogramme par compétence : hauteur = points du barème, vert = réussi, rouge = manqué
const fr = (x: number) => String(Math.round(x * 10) / 10).replace('.', ',');
export function CompetenceHisto({ bars, height = 64 }: { bars: { c: Pick<Competence, 'code' | 'name' | 'color'>; note: number; total: number }[]; height?: number }) {
  const max = Math.max(...bars.map((b) => b.total), 0.0001);
  const w = height > 60 ? 34 : 26;
  return (
    <div className="row" style={{ gap: 6, alignItems: 'flex-end', flexWrap: 'nowrap' }}>
      {bars.map(({ c, note, total }) => {
        const h = (total / max) * height;
        const ok = total ? (note / total) * h : 0;
        return (
          <div
            key={c.code}
            className="stack"
            style={{ gap: 2, alignItems: 'center' }}
            title={`${c.name} : ${fr(note)}/${fr(total)} pts (${total ? Math.round((note / total) * 100) : 0} %) · ${masteryOf(total ? note / total : 0).name}`}
          >
            <span style={{ fontSize: '0.68rem', fontWeight: 700 }}>
              {fr(note)}/{fr(total)}
            </span>
            <div style={{ height, width: w, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <div style={{ height: h, border: '1.5px solid var(--line)', borderRadius: 4, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, background: '#f08a80' }} />
                <div style={{ height: ok, background: 'var(--easy)' }} />
              </div>
            </div>
            <span style={{ background: c.color, borderRadius: 5, padding: '0 4px', fontSize: '0.7rem', fontWeight: 800 }}>{c.code}</span>
          </div>
        );
      })}
    </div>
  );
}

