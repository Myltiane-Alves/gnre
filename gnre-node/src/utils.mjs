/** Escapa caracteres especiais XML para uso em conteúdo de elementos */
export function escapeXml(val) {
  if (val == null) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Remove tudo que não for dígito */
export function somenteDigitos(val = '') {
  return String(val ?? '').replace(/\D/g, '');
}

/** Retorna uma string de data no formato AAAA-MM-DD para hoje + offsetDias */
export function dataHoje(offsetDias = 0) {
  const d = new Date(Date.now() + offsetDias * 86400000);
  return d.toISOString().slice(0, 10);
}
