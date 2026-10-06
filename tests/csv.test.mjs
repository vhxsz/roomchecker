import {test} from 'node:test';
import assert from 'node:assert/strict';
import {csvCell} from '../src/lib/csv.ts';
test('CSV escapes quotes and neutralizes spreadsheet formulas',()=>{
 assert.equal(csvCell('John "A" Smith'),'"John ""A"" Smith"');
 assert.equal(csvCell('=HYPERLINK("test")'),'"\'=HYPERLINK(""test"")"');
 assert.equal(csvCell('  +123'),'"\'  +123"');
 assert.equal(csvCell('101'),'"101"');
});
