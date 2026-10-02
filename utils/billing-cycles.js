function addMonthsClamped(anchor, monthOffset) {
  const targetMonth = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + monthOffset, 1));
  const lastDay = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth(), Math.min(anchor.getUTCDate(), lastDay)));
}

function getCompletedMonthlyCycles(startDate, now = new Date()) {
  const date = new Date(startDate);
  if (Number.isNaN(date.getTime())) return [];

  const anchor = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const cycles = [];
  for (let cycleNumber = 1; ; cycleNumber += 1) {
    const cycleStart = addMonthsClamped(anchor, cycleNumber - 1);
    const cycleEnd = addMonthsClamped(anchor, cycleNumber);
    if (cycleEnd > now) break;
    cycles.push({ cycleStart, cycleEnd });
  }
  return cycles;
}

module.exports = { getCompletedMonthlyCycles };