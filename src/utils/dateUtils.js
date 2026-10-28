const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const isSameOrAfter = require('dayjs/plugin/isSameOrAfter');
const isSameOrBefore = require('dayjs/plugin/isSameOrBefore');
require('dayjs/locale/id'); 

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

dayjs.locale('id');

const DEFAULT_TZ = 'Asia/Makassar'; 

function parseDate(dateString, endOfDay = false) {
    if (!dateString) return null;
    let dt = dayjs.tz(dateString, DEFAULT_TZ);
    
    if (endOfDay) {
        dt = dt.endOf('day'); 
    } else {
        dt = dt.startOf('day'); 
    }
    return dt;
}

function makeDateFilter(sinceDt, untilDt) {
    // FIX: Format string harus persis seperti Python (tanpa milidetik .000Z)
    // Backend ER (Django) sering gagal memparsing millisecond dari Node.js
    return JSON.stringify({
        date_range: {
            lower: sinceDt.utc().format('YYYY-MM-DDTHH:mm:ss+00:00'),
            upper: untilDt.utc().format('YYYY-MM-DDTHH:mm:ss+00:00')
        }
    });
}

function fmtDt(value, format = 'DD MMM YYYY  HH:mm') {
    if (!value) return '-';
    const dt = dayjs(value);
    if (!dt.isValid()) return String(value);
    return dt.tz(DEFAULT_TZ).format(format);
}

function fmtDur(startStr, endStr) {
    if (!startStr || !endStr) return '-';

    const start = dayjs(startStr);
    const end = dayjs(endStr);

    if (!start.isValid() || !end.isValid()) return '-';

    const diffMinutes = end.diff(start, 'minute');
    if (diffMinutes < 0) return '-'; 

    const h = Math.floor(diffMinutes / 60);
    const m = diffMinutes % 60;

    if (h > 0) return `${h}j ${m}m`;
    return `${m}m`;
}

function patrolInRange(patrol, sinceDt, untilDt) {
    const segs = patrol.patrol_segments || [];
    const startRaw = patrol.start_time || (segs[0]?.time_range?.start_time);
    if (!startRaw) return false;

    const startDt = dayjs(startRaw);
    if (!startDt.isValid()) return false;

    return startDt.isSameOrAfter(sinceDt) && startDt.isSameOrBefore(untilDt);
}

function eventInRange(ev, sinceDt, untilDt) {
    const fields = ['time', 'created_at', 'updated_at'];
    for (const field of fields) {
        const rawValue = ev[field];
        if (rawValue) {
            const dt = dayjs(rawValue);
            if (dt.isValid()) {
                if (dt.isSameOrAfter(sinceDt) && dt.isSameOrBefore(untilDt)) return true;
            }
        }
    }
    return false;
}

module.exports = {
    parseDate,
    makeDateFilter,
    fmtDt,
    fmtDur,
    patrolInRange,
    eventInRange
};