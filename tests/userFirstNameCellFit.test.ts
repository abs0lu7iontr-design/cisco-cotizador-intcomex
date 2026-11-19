import { describe, it } from 'node:test';
import assert from 'node:assert';
import { formatShortUserFirstName, getShortDisplayName } from '../src/utils/userNameUtils';

describe('User First Name Formatting & Table Cell Fit Suite', () => {
  it('should normalize known administrative and PM accounts to their concise first names', () => {
    assert.strictEqual(formatShortUserFirstName('Mauricio Skill (Administrador)'), 'Mauricio');
    assert.strictEqual(formatShortUserFirstName('Mauricio Skill'), 'Mauricio');
    assert.strictEqual(formatShortUserFirstName('mskill'), 'Mauricio');
    assert.strictEqual(formatShortUserFirstName('pm_cisco'), 'Mauricio');
    assert.strictEqual(formatShortUserFirstName('mauricioskill'), 'Mauricio');

    assert.strictEqual(formatShortUserFirstName('Luis Burgos (Preventa)'), 'Luis');
    assert.strictEqual(formatShortUserFirstName('Luis Burgos'), 'Luis');
    assert.strictEqual(formatShortUserFirstName('lburgos'), 'Luis');

    assert.strictEqual(formatShortUserFirstName('Johana Valencia'), 'Johana');
    assert.strictEqual(formatShortUserFirstName('jvalencia'), 'Johana');

    assert.strictEqual(formatShortUserFirstName('Marta Adasme'), 'Marta');
    assert.strictEqual(formatShortUserFirstName('madasme'), 'Marta');

    assert.strictEqual(formatShortUserFirstName('Raul Cuevas'), 'Raul');
    assert.strictEqual(formatShortUserFirstName('Raúl Cuevas'), 'Raul');
    assert.strictEqual(formatShortUserFirstName('rcuevas'), 'Raul');
  });

  it('should extract first name from general two-word or multi-word user strings', () => {
    assert.strictEqual(formatShortUserFirstName('Carlos Gonzalez'), 'Carlos');
    assert.strictEqual(formatShortUserFirstName('Ana Maria Perez'), 'Ana');
    assert.strictEqual(formatShortUserFirstName('Diego Valenzuela (Admin)'), 'Diego');
  });

  it('should handle undefined, null, or empty values safely', () => {
    assert.strictEqual(formatShortUserFirstName(undefined), 'Usuario');
    assert.strictEqual(formatShortUserFirstName(null), 'Usuario');
    assert.strictEqual(formatShortUserFirstName(''), 'Usuario');
    assert.strictEqual(formatShortUserFirstName('   '), 'Usuario');
  });

  it('getShortDisplayName should format UserSession or Creator objects correctly', () => {
    assert.strictEqual(
      getShortDisplayName({ fullName: 'Mauricio Skill (Administrador)', username: 'pm_cisco' }),
      'Mauricio'
    );
    assert.strictEqual(
      getShortDisplayName({ full_name: 'Luis Burgos', username: 'lburgos' }),
      'Luis'
    );
    assert.strictEqual(
      getShortDisplayName({ username: 'jvalencia' }),
      'Johana'
    );
    assert.strictEqual(getShortDisplayName(null), 'Usuario');
  });

  it('should ensure all normalized names are concise to guarantee table cell fitting', () => {
    const testCases = [
      'Mauricio Skill (Administrador)',
      'Luis Burgos',
      'Johana Valencia',
      'Marta Adasme',
      'Raul Cuevas',
      'mskill',
      'pm_cisco',
      'lburgos',
      'jvalencia',
      'madasme',
      'rcuevas',
    ];

    for (const name of testCases) {
      const shortName = formatShortUserFirstName(name);
      assert.ok(
        shortName.length <= 12,
        `Expected shortName for "${name}" to be <= 12 chars for table cell fit, but got "${shortName}" (len: ${shortName.length})`
      );
    }
  });
});
