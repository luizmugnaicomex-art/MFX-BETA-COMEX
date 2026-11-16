import type { CSSProperties } from 'react';

export function formatCompactBrl(value: number, showZero = false): string {
  if (!Number.isFinite(value)) return '';
  if (value === 0) return showZero ? 'R$ 0' : '';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    return `${sign}R$ ${(abs / 1_000_000).toFixed(2).replace('.', ',')}M`;
  }
  if (abs >= 100_000) {
    return `${sign}R$ ${Math.round(abs / 1_000)}k`;
  }
  if (abs >= 1_000) {
    return `${sign}R$ ${(abs / 1_000).toFixed(1).replace('.', ',')}k`;
  }
  return `${sign}R$ ${Math.round(abs)}`;
}

export function formatAxisBrl(value: number): string {
  if (!Number.isFinite(value) || value === 0) return 'R$0';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    const num = abs / 1_000_000;
    const str = Number.isInteger(num) ? String(num) : num.toFixed(1).replace('.', ',');
    return `${sign}R$${str}M`;
  }
  if (abs >= 1_000) {
    return `${sign}R$${Math.round(abs / 1_000)}k`;
  }
  return `${sign}R$${Math.round(abs)}`;
}

export function formatCompactQty(value: number, showZero = false): string {
  if (!Number.isFinite(value)) return '';
  if (value === 0) return showZero ? '0' : '';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(1).replace('.', ',')}M`;
  }
  if (abs >= 10_000) {
    return `${sign}${(abs / 1_000).toFixed(1).replace('.', ',')}k`;
  }
  return `${sign}${Math.round(abs).toLocaleString('pt-BR')}`;
}

export const CHART_TOOLTIP_STYLE: CSSProperties = {
  backgroundColor: '#0f172a',
  borderColor: '#334155',
  borderRadius: '8px',
  fontSize: '12px',
  color: '#f8fafc',
};

export const CHART_TOOLTIP_ITEM_STYLE: CSSProperties = {
  color: '#f8fafc',
};

export const CHART_TOOLTIP_LABEL_STYLE: CSSProperties = {
  color: '#cbd5e1',
  fontWeight: 600,
  marginBottom: '2px',
};
