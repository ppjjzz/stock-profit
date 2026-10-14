/** Calendar dates use the user's configured market-workbench timezone. */
export function recentYears(years: number, now = new Date()) {
  const end = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Shanghai'}).format(now);
  const [year,month,day] = end.split('-').map(Number);
  const targetYear = year - years;
  const lastDay = new Date(Date.UTC(targetYear,month,0)).getUTCDate();
  const start = `${targetYear}-${String(month).padStart(2,'0')}-${String(Math.min(day,lastDay)).padStart(2,'0')}`;
  return {start,end};
}
