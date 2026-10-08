import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Student } from '../lib/db';
import { setPhoto } from '../lib/photos';
import { mediaUrl } from './CardFace';

export function usePhoto(photoId?: string) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (photoId) mediaUrl(photoId).then((u) => alive && setUrl(u));
    else setUrl(null);
    return () => {
      alive = false;
    };
  }, [photoId]);
  return url;
}

// Photo de l'élève (ou ses initiales). Avec `editable`, un clic permet de choisir une photo.
export function Avatar({
  student,
  size = 36,
  editable = false,
  zoom = false,
}: {
  student: Student;
  size?: number;
  editable?: boolean;
  zoom?: boolean; // agrandit la photo au survol de la souris
}) {
  const url = usePhoto(student.photoId);
  const [hover, setHover] = useState<DOMRect | null>(null);
  const zoomProps =
    zoom && url
      ? {
          onMouseEnter: (e: React.MouseEvent) => setHover((e.currentTarget as HTMLElement).getBoundingClientRect()),
          onMouseLeave: () => setHover(null),
        }
      : {};
  // Aperçu rendu directement dans la page (portail) : Safari le couperait sinon à l'intérieur du cadre rond
  const preview =
    hover && url ? createPortal(
      <img
        src={url}
        alt=""
        style={{
          position: 'fixed',
          // À gauche de la photo pour ne jamais cacher le nom ; au-dessus si la place manque à gauche
          ...(hover.left - 190 >= 8
            ? { left: hover.left - 190, top: Math.max(8, Math.min(window.innerHeight - 248, hover.top + hover.height / 2 - 120)) }
            : { left: Math.max(8, hover.left), top: hover.top - 250 >= 8 ? hover.top - 250 : hover.bottom + 10 }),
          width: 180,
          height: 240,
          objectFit: 'cover',
          borderRadius: 16,
          border: 'var(--border)',
          boxShadow: 'var(--shadow)',
          background: 'var(--paper)',
          zIndex: 40,
          pointerEvents: 'none',
        }}
      />,
      document.body,
    ) : null;
  const initials = (student.firstName[0] ?? '') + (student.lastName[0] ?? '');
  const style = {
    width: size,
    height: size,
    borderRadius: size > 60 ? 18 : '50%',
    border: '2px solid var(--line)',
    flex: 'none' as const,
    overflow: 'hidden',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--divers)',
    fontWeight: 900,
    fontSize: size * 0.38,
    position: 'relative' as const,
    cursor: editable ? 'pointer' : undefined,
  };
  const content = url ? (
    <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
  ) : (
    <span>{initials.toUpperCase()}</span>
  );
  if (!editable)
    return (
      <span style={style} {...zoomProps}>
        {content}
        {preview}
      </span>
    );
  return (
    <label style={style} title={url ? 'Changer la photo' : 'Ajouter une photo'} onClick={(e) => e.stopPropagation()} {...zoomProps}>
      {content}
      {preview}
      <input
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setPhoto(student.id, f, f.name);
        }}
      />
    </label>
  );
}

export function StudentName({ student, size = 32, short = false }: { student: Student; size?: number; short?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <Avatar student={student} size={size} zoom />
      <span>{short ? `${student.firstName} ${student.lastName[0]}.` : `${student.lastName} ${student.firstName}`}</span>
    </span>
  );
}
