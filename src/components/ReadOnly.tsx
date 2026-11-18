// Co-enseignement : bandeau « lecture seule » et zone dont les boutons et champs sont désactivés.
import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { useTeacherName } from '../lib/access';

export function ReadOnlyNote({ ownerId, what }: { ownerId?: string; what: string }) {
  const name = useTeacherName(ownerId);
  return (
    <div className="panel calm row small" style={{ gap: 8 }}>
      <Icon name="lock" size={16} />
      <span>
        {what} de <b>{name ?? 'un collègue'}</b>, partagée avec vous en <b>lecture seule</b>.
      </span>
    </div>
  );
}

// Tous les boutons, cases et champs à l'intérieur sont désactivés (les liens restent utilisables)
export function ReadOnlyZone({ readOnly, children, className }: { readOnly: boolean; children: ReactNode; className?: string }) {
  if (!readOnly) return <>{children}</>;
  return (
    <fieldset disabled className={(className ?? '') + ' readonly-zone'} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      {children}
    </fieldset>
  );
}
