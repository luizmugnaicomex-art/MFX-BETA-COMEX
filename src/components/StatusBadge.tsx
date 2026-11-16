import React from 'react';

interface StatusBadgeProps {
  label: string;
  tone?: 'emerald' | 'amber' | 'rose' | 'cyan' | 'slate';
}

const TONE_CLASSES: Record<NonNullable<StatusBadgeProps['tone']>, string> = {
  emerald:
    'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
  amber:
    'bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/25',
  rose:
    'bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/25',
  cyan:
    'bg-cyan-500/12 text-cyan-700 dark:text-cyan-300 border-cyan-500/25',
  slate:
    'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ label, tone = 'slate' }) => {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border whitespace-nowrap shrink-0 ${TONE_CLASSES[tone]}`}
    >
      {label}
    </span>
  );
};

export function getDeliveryStatusTone(status: string): StatusBadgeProps['tone'] {
  if (status === 'NO PRAZO' || status === 'ENTREGA CONCLUIDA SAP') return 'emerald';
  if (status === 'ATRASADO') return 'rose';
  if (status === 'ITEM EXCLUIDO') return 'slate';
  return 'amber';
}

export function getChannelTone(canal: string): StatusBadgeProps['tone'] {
  if (canal === 'VERDE' || canal === 'VD') return 'emerald';
  if (canal === 'AMARELO' || canal === 'AM') return 'amber';
  if (canal === 'VERMELHO' || canal === 'VM') return 'rose';
  return 'slate';
}

export function getShipmentStatusTone(status: string): StatusBadgeProps['tone'] {
  if (status === 'ENTREGUE') return 'emerald';
  if (status === 'PARADO AG. DRAWBACK') return 'rose';
  if (status === 'AG. DESEMBARAÇO') return 'amber';
  if (status === 'EM TRÂNSITO') return 'cyan';
  return 'slate';
}

export function getFinancialStatusTone(status: string): StatusBadgeProps['tone'] {
  if (status === 'PAGO') return 'emerald';
  if (status === 'VENCIDA') return 'rose';
  if (status === 'A VENCER') return 'amber';
  return 'cyan';
}
