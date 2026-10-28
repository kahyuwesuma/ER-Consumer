/**
 * Generates CSV content string from processed Patrol & Standalone Events data.
 */
function generateCsvBuffer(patrols, standaloneEvents = []) {
  const lines = [];

  // Header CSV Patrol
  lines.push(['No', 'Serial', 'Judul Patrol', 'Status', 'Tipe Patrol', 'Waktu Mulai', 'Waktu Selesai', 'Durasi', 'Total Segmen'].map(c => `"${c}"`).join(','));

  patrols.forEach((p, i) => {
    lines.push([
      i + 1,
      `#${p.serial_number || '?'}`,
      p.title || p.type || 'Untitled',
      p.state || '-',
      p.type || '-',
      p.start_fmt || '-',
      p.end_fmt || '-',
      p.duration || '-',
      p.segments ? p.segments.length : 0
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  });

  if (standaloneEvents && standaloneEvents.length > 0) {
    lines.push('');
    lines.push(['--- EVENTS MANDIRI (STANDALONE) ---']);
    lines.push(['No', 'Judul Event', 'Tipe Event', 'Status', 'Prioritas', 'Waktu', 'Pelapor', 'Koordinat'].map(c => `"${c}"`).join(','));

    standaloneEvents.forEach((ev, i) => {
      lines.push([
        i + 1,
        ev.title || '-',
        ev.type || '-',
        ev.state || '-',
        ev.priority || '-',
        ev.time_fmt || '-',
        ev.reporter || '-',
        ev.coordinates || '-'
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    });
  }

  return lines.join('\n');
}

module.exports = { generateCsvBuffer };