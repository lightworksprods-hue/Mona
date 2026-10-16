function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
}

function escapeCsv(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downloadCsv(filename, sections) {
  const lines = [];
  sections.forEach((section, index) => {
    if (index > 0) lines.push('');
    if (section.title) lines.push(escapeCsv(section.title));
    lines.push(section.headers.map(escapeCsv).join(','));
    section.rows.forEach((row) => lines.push(row.map(escapeCsv).join(',')));
  });

  const blob = new Blob([`\ufeff${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function printReport({ title, subtitle, summary = [], columns, rows }) {
  const printWindow = window.open('', '_blank', 'width=1000,height=760');
  if (!printWindow) return false;

  const summaryHtml = summary.map(([label, value]) => (
    `<div class="summary-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
  )).join('');
  const headHtml = columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('');
  const bodyHtml = rows.map((row) => `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join('')}</tr>`).join('');

  printWindow.document.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title><style>
    :root{color:#182230;background:#fff;font-family:Arial,sans-serif}body{margin:32px;color:#182230}
    .report-head{display:flex;align-items:center;gap:14px;border-bottom:3px solid #c2185b;padding-bottom:16px}
    .report-head img{width:64px;height:78px;object-fit:contain}.brand{color:#c2185b;font-size:24px;font-weight:800;margin:0}
    .subtitle{color:#667085;font-size:12px;margin:5px 0 0}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:20px 0}
    .summary-card{border:1px solid #e5e7eb;border-radius:8px;padding:12px}.summary-card span{display:block;color:#667085;font-size:10px;text-transform:uppercase}.summary-card strong{display:block;margin-top:7px;font-size:17px;color:#c2185b}
    table{width:100%;border-collapse:collapse;font-size:11px}th{background:#fff1f5;color:#8f1248;text-align:left;font-size:10px;text-transform:uppercase}th,td{padding:9px;border:1px solid #e5e7eb}td{vertical-align:top}
    .footer{margin-top:20px;color:#667085;font-size:10px;text-align:right}@media print{body{margin:12mm}.summary-card{break-inside:avoid}}
  </style></head><body><header class="report-head"><img src="/mona-removebg-preview.png" alt="Mona logo"><div><h1 class="brand">Mona's Grocery Store</h1><p class="subtitle">${escapeHtml(title)} · ${escapeHtml(subtitle)}</p></div></header>
  <section class="summary">${summaryHtml}</section><table><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml || '<tr><td colspan="99">No records found.</td></tr>'}</tbody></table><div class="footer">Generated ${escapeHtml(new Date().toLocaleString('en-PH'))}</div><script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script></body></html>`);
  printWindow.document.close();
  return true;
}
