// Suite headless: CRM intern — coerce activitate (schema/default/clamp, niciodată throw).
import { coerceToCrmActivity, ACTIVITY_BODY_MAX } from '../src/types/crmActivity';

let failures = 0;
function check(name: string, ok: boolean): void {
  if (ok) console.log(`  ✓ ${name}`);
  else { failures++; console.error(`  ✗ ${name}`); }
}

console.log('CRM — coerce activitate');

{
  const a = coerceToCrmActivity(null);
  check('coerce: null → schema 1 + note + goluri', a.schema === 1 && a.type === 'note' && a.body === '' && a.at === 0 && a.dueAt === '' && a.createdBy === '');
}
check('coerce: gunoi nu aruncă', !!coerceToCrmActivity({ type: 7, body: 9, at: 'x', dueAt: 5 }));
check('coerce: tip invalid → note; tip valid păstrat', coerceToCrmActivity({ type: 'zzz' }).type === 'note' && coerceToCrmActivity({ type: 'call' }).type === 'call');
check('coerce: body clamp la 2000', coerceToCrmActivity({ body: 'x'.repeat(5000) }).body.length === ACTIVITY_BODY_MAX);
check('coerce: at non-număr → 0; număr păstrat', coerceToCrmActivity({ at: 'x' }).at === 0 && coerceToCrmActivity({ at: 1234 }).at === 1234);
check('coerce: dueAt clamp la 10 (YYYY-MM-DD)', coerceToCrmActivity({ dueAt: '2026-06-21T12:00' }).dueAt === '2026-06-21');
check('coerce: id păstrat doar dacă e string', coerceToCrmActivity({ id: 'a1' }).id === 'a1' && coerceToCrmActivity({ id: 7 }).id === undefined);

console.log(`\ncrm: ${failures ? failures + ' EȘUATE' : 'all checks passed'}`);
if (failures) process.exit(1);
