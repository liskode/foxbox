import { useEffect, useState } from 'react';
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
export function Avatar({ student, size = 36, editable = false }: { student: Student; size?: number; editable?: boolean }) {
  const url = usePhoto(student.photoId);
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
  if (!editable) return <span style={style}>{content}</span>;
  return (
    <label style={style} title={url ? 'Changer la photo' : 'Ajouter une photo'} onClick={(e) => e.stopPropagation()}>
      {content}
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
      <Avatar student={student} size={size} />
      <span>{short ? `${student.firstName} ${student.lastName[0]}.` : `${student.lastName} ${student.firstName}`}</span>
    </span>
  );
}
