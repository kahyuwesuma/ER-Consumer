const crypto = require('crypto');
const EarthRangerModel = require('../models/earthrangerModel');
const { parseDate, todayEnd, makeDateFilter, patrolInRange, eventInRange, fmtDt, fmtDur } = require('../utils/dateUtils');
const pdfBuilder = require('../utils/pdfBuilder');
const jobStore = require('../utils/jobStore');
const { generateCsvBuffer } = require('../views/csvView');

const EV_INCLUDE = { include_files: true, include_details: true, include_notes: true };

const ownerOf = (req) =>
  crypto.createHash('sha256').update(req.cookies.er_token || '').digest('hex');

function makeFilename(baseUrl, since, until, ext) {
  let site = 'ER';
  try { site = new URL(baseUrl).hostname.split('.')[0].toUpperCase(); } catch (e) { /* pakai default */ }

  const today = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10); // tanggal WITA
  let range = `semua_${today}`;
  if (since) range = !until || until === since ? since : `${since}_sd_${until}`;

  return `Laporan_Patrol_${site}_${range}.${ext}`.replace(/[^\w.-]/g, '_');
}

class ReportController {
  static async renderDashboard(req, res) {
    if (!req.cookies.er_token) return res.redirect('/login');
    res.render('dashboard', { baseUrl: req.cookies.er_base_url });
  }

  // POST /report/start -> jalankan di background, balas jobId
  static async start(req, res) {
    if (!req.cookies.er_token) return res.status(401).json({ error: 'Belum login' });

    const job = jobStore.create(ownerOf(req));
    const progress = (pct, msg) => jobStore.update(job, pct, msg);

    ReportController.buildReport(req.body, req.cookies, progress)
      .then((result) => jobStore.done(job, result))
      .catch((err) => {
        const detail = err.response
          ? ` (HTTP ${err.response.status}: ${JSON.stringify(err.response.data).slice(0, 200)})`
          : '';
        console.error(err);
        err.message += detail;
        jobStore.fail(job, err);
      });

    res.json({ jobId: job.id });
  }

  // GET /report/progress/:id -> Server-Sent Events
  static progress(req, res) {
    const job = jobStore.get(req.params.id, ownerOf(req));
    if (!job) return res.sendStatus(404);

    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    const send = (s) => res.write(`data: ${JSON.stringify(s)}\n\n`);
    send(jobStore.snap(job));
    if (job.status !== 'running') return res.end();

    const onProgress = (s) => {
      send(s);
      if (s.status !== 'running') {
        job.emitter.off('progress', onProgress);
        res.end();
      }
    };
    job.emitter.on('progress', onProgress);
    req.on('close', () => job.emitter.off('progress', onProgress));
  }

  // GET /report/download/:id
  static download(req, res) {
    const job = jobStore.get(req.params.id, ownerOf(req));
    if (!job || job.status !== 'done') return res.sendStatus(404);
    const { buffer, contentType, filename } = job.result;
    res.attachment(filename);                    // harus lebih dulu (ikut mengatur Content-Type)
    res.setHeader('Content-Type', contentType);  // lalu tetapkan tipe isi yang benar
    res.send(buffer);
  }

  static async buildReport(body, cookies, progress) {
    const { since, until, limit, includePhotos, hideEmptySegs, includeStandalone, format } = body;
    const baseUrl = cookies.er_base_url;
    const model = new EarthRangerModel(baseUrl, cookies.er_token);

    const sinceDt = since ? parseDate(since) : null;
    let untilDt = until ? parseDate(until, true) : null;
    if (sinceDt && !untilDt) untilDt = todayEnd();

    // ── 1. Patrols ─────────────────────────────────────────
    progress(2, 'Mengambil data patrol...');
    const kw = { page_size: 100 };
    if (sinceDt) kw.filter = makeDateFilter(sinceDt, untilDt);
    const patrols = await model.getPatrols(kw, sinceDt ? Infinity : (parseInt(limit) || 50));

    if (sinceDt) {
      progress(8, 'Memeriksa patrol tambahan...');
      const seenIds = new Set(patrols.map((p) => p.id));
      const allPatrols = await model.getPatrols({ page_size: 100 }, 500);
      for (const p of allPatrols) {
        if (!seenIds.has(p.id) && patrolInRange(p, sinceDt, untilDt)) {
          patrols.push(p);
          seenIds.add(p.id);
        }
      }
      patrols.sort((a, b) => (a.serial_number || 0) - (b.serial_number || 0));
    }
    progress(15, `${patrols.length} patrol ditemukan. Mengambil events...`);

    // ── 2. Events ──────────────────────────────────────────
    const evKw = { ...EV_INCLUDE, page_size: 100 };
    if (sinceDt) evKw.filter = makeDateFilter(sinceDt, untilDt);

    const evMap = {};
    for (const ev of await model.getEvents(evKw)) evMap[ev.id] = ev;

    if (sinceDt) {
      progress(22, 'Memeriksa events tambahan...');
      const allEvs = await model.getEvents({ ...EV_INCLUDE, page_size: 100 }, 2000);
      for (const ev of allEvs) {
        if (ev.id && !evMap[ev.id] && eventInRange(ev, sinceDt, untilDt)) evMap[ev.id] = ev;
      }
    }

    // ── 3. Pisahkan events patrol vs mandiri ───────────────
    const patrolEvIds = new Set();
    patrols.forEach((p) => (p.patrol_segments || []).forEach((seg) =>
      (seg.events || []).forEach((e) => { if (e.id) patrolEvIds.add(e.id); })));

    let standaloneEvents = [];
    if (includeStandalone === 'on') {
      standaloneEvents = Object.values(evMap)
        .filter((ev) => !patrolEvIds.has(ev.id))
        .sort((a, b) => String(b.time || b.created_at || '').localeCompare(String(a.time || a.created_at || '')));
    }

    console.log(`[report] ${since || '-'} s/d ${until || '-'} | patrols=${patrols.length} ` +
      `events=${Object.keys(evMap).length} patrolEvents=${patrolEvIds.size} standalone=${standaloneEvents.length}`);

    progress(30, `${Object.keys(evMap).length} events ditemukan. Memproses...`);

    // ── Hitung total untuk progress bar ────────────────────
    const totalToProcess =
      patrols.reduce((n, p) => n + (p.patrol_segments || [])
        .reduce((m, s) => m + (s.events || []).length, 0), 0) + standaloneEvents.length;
    let processed = 0;
    const tick = () => {
      processed++;
      progress(
        30 + (processed / Math.max(totalToProcess, 1)) * 55,
        `Memproses event ${processed}/${totalToProcess}` + (includePhotos === 'on' ? ' (termasuk foto)' : ''),
      );
    };

    // ── Format event untuk view ────────────────────────────
    const formatEvent = async (ev) => {
      const loc = ev.location;
      const coordStr = (loc?.latitude != null && loc?.longitude != null)
        ? `${Number(loc.latitude).toFixed(5)}, ${Number(loc.longitude).toFixed(5)}`
        : '-';

      const photos = [];
      if (includePhotos === 'on' && ev.files) {
        for (const f of ev.files) {
          const isImg = f.file_type === 'image' || (f.filename && /\.(jpe?g|png|webp|gif)$/i.test(f.filename));
          if (!isImg) continue;
          const b64 = await model.getPhotoBase64(f.images?.large || f.images?.original || f.url || f.uri);
          if (b64) photos.push({ src: b64, caption: f.comment || f.filename });
        }
      }

      let notes = ev.message || (typeof ev.notes === 'string' ? ev.notes : '');
      if (!notes && Array.isArray(ev.notes) && ev.notes.length) {
        notes = ev.notes.map((n) => n.text).filter(Boolean).join('; ');
      }

      tick();
      return {
        title: ev.title || ev.event_type_display || ev.event_type || '-',
        type: ev.event_type_display || ev.event_type || '-',
        time_fmt: fmtDt(ev.time || ev.created_at),
        state: (ev.state || 'active').toUpperCase(),
        priority: ev.priority_label || ev.priority || 'Gray',
        reporter: ev.reported_by?.name || ev.reported_by?.display_name || ev.reported_by?.username || '-',
        notes: notes || '-',
        coordinates: coordStr,
        photos,
      };
    };

    // ── Transform patrols ──────────────────────────────────
    const cleanPatrols = [];
    for (const p of patrols) {
      const segs = p.patrol_segments || [];
      const start = p.start_time || segs[0]?.time_range?.start_time || '';
      const end = p.end_time || segs[segs.length - 1]?.time_range?.end_time || '';

      const processedSegs = [];
      for (const seg of segs) {
        const segEvs = [];
        for (const e of (seg.events || [])) segEvs.push(await formatEvent(evMap[e.id] || e));
        if (hideEmptySegs === 'on' && segEvs.length === 0) continue;

        processedSegs.push({
          leader: seg.leader?.name || seg.leader?.display_name || '-',
          type: seg.patrol_type || '-',
          start_fmt: fmtDt(seg.time_range?.start_time),
          end_fmt: fmtDt(seg.time_range?.end_time),
          duration: fmtDur(seg.time_range?.start_time, seg.time_range?.end_time),
          events: segEvs,
        });
      }

      cleanPatrols.push({
        serial_number: p.serial_number ?? '?',
        title: p.title || p.patrol_type || segs[0]?.patrol_type || 'Patrol Tanpa Judul',
        state: (p.state || 'Unknown').toUpperCase(),
        type: p.patrol_type || segs[0]?.patrol_type || '-',
        start_fmt: fmtDt(start),
        end_fmt: fmtDt(end),
        duration: fmtDur(start, end),
        segments: processedSegs,
      });
    }

    const cleanStandalone = [];
    for (const ev of standaloneEvents) cleanStandalone.push(await formatEvent(ev));

    const patrolEvCount = cleanPatrols.reduce(
      (acc, p) => acc + p.segments.reduce((s, seg) => s + seg.events.length, 0), 0);
    const summary = {
      totalPatrols: cleanPatrols.length,
      totalStandalone: cleanStandalone.length,
      totalEvents: patrolEvCount + cleanStandalone.length,
    };

    // ── CSV ────────────────────────────────────────────────
    if (format === 'csv') {
      progress(90, 'Menyusun CSV...');
      return {
        buffer: Buffer.from('\uFEFF' + generateCsvBuffer(cleanPatrols, cleanStandalone), 'utf8'),
        contentType: 'text/csv; charset=utf-8',
        filename: makeFilename(baseUrl, since, until, 'csv'),
      };
    }

    // ── PDF ────────────────────────────────────────────────
    progress(90, 'Merender PDF...');
    const buffer = await pdfBuilder.createPDF('report_pdf', {
      baseUrl,
      period: since ? `${since} s/d ${until || 'Hari Ini'}` : 'Semua Waktu',
      patrols: cleanPatrols,
      standaloneEvents: cleanStandalone,
      summary,
    });
    return {
      buffer,
      contentType: 'application/pdf',
      filename: makeFilename(baseUrl, since, until, 'pdf'),
    };
  }
}

module.exports = ReportController;