import { describe, expect, it } from 'vitest';
import { parseSource } from '../../src/engine/parse.js';
import { review } from '../helpers/review.js';

describe('IEC 62443 cybersecurity checks (real parser)', () => {
  describe('HARDCODED_CREDENTIALS', () => {
    it('flags a global STRING named like a password with a literal value', async () => {
      const after = await parseSource(
        `VAR_GLOBAL
    sAdminPassword : STRING := 'hunter2';
END_VAR
`,
        'secrets.st',
      );
      const findings = review([], [after]);
      const c = findings.filter((f) => f.category === 'HARDCODED_CREDENTIALS');
      expect(c).toHaveLength(1);
      expect(c[0].summary).toContain('sAdminPassword');
    });

    it('flags a local STRING named like an API key with a literal value', async () => {
      const after = await parseSource(
        `FUNCTION_BLOCK FB_X
VAR
    sApiKey : STRING := 'sk-1234567890';
END_VAR
END_FUNCTION_BLOCK
`,
        'fb.st',
      );
      const findings = review([], [after]);
      expect(
        findings.filter((f) => f.category === 'HARDCODED_CREDENTIALS'),
      ).toHaveLength(1);
    });

    it('does NOT flag a placeholder value like <CHANGE_ME>', async () => {
      const after = await parseSource(
        `VAR_GLOBAL
    sPassword : STRING := '<CHANGE_ME>';
END_VAR
`,
        'secrets.st',
      );
      const findings = review([], [after]);
      expect(
        findings.filter((f) => f.category === 'HARDCODED_CREDENTIALS'),
      ).toHaveLength(0);
    });

    it('does NOT flag a STRING global without a secret-shaped name', async () => {
      const after = await parseSource(
        `VAR_GLOBAL
    sStationName : STRING := 'LineA-Station3';
END_VAR
`,
        'config.st',
      );
      const findings = review([], [after]);
      expect(
        findings.filter((f) => f.category === 'HARDCODED_CREDENTIALS'),
      ).toHaveLength(0);
    });
  });

  describe('HARDCODED_NETWORK_ENDPOINT', () => {
    it('flags a literal IPv4 address in a STRING global', async () => {
      const after = await parseSource(
        `VAR_GLOBAL
    sScadaHost : STRING := '10.0.0.5';
END_VAR
`,
        'config.st',
      );
      const findings = review([], [after]);
      const c = findings.filter(
        (f) => f.category === 'HARDCODED_NETWORK_ENDPOINT',
      );
      expect(c).toHaveLength(1);
      expect(c[0].summary).toContain('10.0.0.5');
    });

    it('flags an OPC UA URL', async () => {
      const after = await parseSource(
        `VAR_GLOBAL
    sOpcServer : STRING := 'opc.tcp://server.local:4840';
END_VAR
`,
        'config.st',
      );
      const findings = review([], [after]);
      expect(
        findings.filter((f) => f.category === 'HARDCODED_NETWORK_ENDPOINT'),
      ).toHaveLength(1);
    });

    it('does NOT flag the loopback / unspecified addresses', async () => {
      const after = await parseSource(
        `VAR_GLOBAL
    sLoopback : STRING := '127.0.0.1';
    sUnspec   : STRING := '0.0.0.0';
END_VAR
`,
        'config.st',
      );
      const findings = review([], [after]);
      expect(
        findings.filter((f) => f.category === 'HARDCODED_NETWORK_ENDPOINT'),
      ).toHaveLength(0);
    });
  });

  describe('UNVALIDATED_INPUT_USE', () => {
    it('flags a VAR_INPUT used as an array subscript with no guard', async () => {
      const after = await parseSource(
        `FUNCTION_BLOCK FB_Lookup
VAR_INPUT
    idx : INT;
END_VAR
VAR
    arr : ARRAY [0..9] OF INT;
END_VAR
arr[idx] := 1;
END_FUNCTION_BLOCK
`,
        'fb.st',
      );
      const findings = review([], [after]);
      const c = findings.filter((f) => f.category === 'UNVALIDATED_INPUT_USE');
      expect(c).toHaveLength(1);
      expect(c[0].summary).toContain("'idx'");
    });

    it('does NOT flag when an IF guards the input via a relational op', async () => {
      const after = await parseSource(
        `FUNCTION_BLOCK FB_Lookup
VAR_INPUT
    idx : INT;
END_VAR
VAR
    arr : ARRAY [0..9] OF INT;
END_VAR
IF idx >= 0 AND idx <= 9 THEN
    arr[idx] := 1;
END_IF;
END_FUNCTION_BLOCK
`,
        'fb.st',
      );
      const findings = review([], [after]);
      expect(
        findings.filter((f) => f.category === 'UNVALIDATED_INPUT_USE'),
      ).toHaveLength(0);
    });

    it('flags a VAR_INPUT used as a divisor with no guard', async () => {
      const after = await parseSource(
        `FUNCTION_BLOCK FB_Divide
VAR_INPUT
    denom : INT;
END_VAR
VAR
    q : INT;
END_VAR
q := 100 / denom;
END_FUNCTION_BLOCK
`,
        'fb.st',
      );
      const findings = review([], [after]);
      expect(
        findings.filter((f) => f.category === 'UNVALIDATED_INPUT_USE'),
      ).toHaveLength(1);
    });
  });

  describe('DEBUG_PRAGMA_IN_PRODUCTION', () => {
    it('flags a CODESYS monitoring pragma in a production path', async () => {
      const after = await parseSource(
        `{attribute 'monitoring' := 'variable'}
FUNCTION_BLOCK FB_M
VAR
    iCount : INT;
END_VAR
END_FUNCTION_BLOCK
`,
        'src/FB_M.st',
      );
      const findings = review([], [after]);
      const c = findings.filter(
        (f) => f.category === 'DEBUG_PRAGMA_IN_PRODUCTION',
      );
      expect(c).toHaveLength(1);
      expect(c[0].summary).toContain("monitoring");
    });

    it('does NOT flag the same pragma in a tests/ path', async () => {
      const after = await parseSource(
        `{attribute 'monitoring' := 'variable'}
FUNCTION_BLOCK FB_M
END_FUNCTION_BLOCK
`,
        'tests/FB_M.st',
      );
      const findings = review([], [after]);
      expect(
        findings.filter((f) => f.category === 'DEBUG_PRAGMA_IN_PRODUCTION'),
      ).toHaveLength(0);
    });
  });

  describe('PERSISTENT_PLAINTEXT_SECRET', () => {
    it('flags a VAR_GLOBAL PERSISTENT secret-named declaration', async () => {
      const after = await parseSource(
        `VAR_GLOBAL PERSISTENT
    sAdminPassword : STRING;
END_VAR
`,
        'secrets.st',
      );
      const findings = review([], [after]);
      const c = findings.filter(
        (f) => f.category === 'PERSISTENT_PLAINTEXT_SECRET',
      );
      expect(c).toHaveLength(1);
      expect(c[0].summary).toContain('sAdminPassword');
    });

    it('flags a VAR_GLOBAL RETAIN secret-named declaration', async () => {
      const after = await parseSource(
        `VAR_GLOBAL RETAIN
    sApiToken : STRING;
END_VAR
`,
        'secrets.st',
      );
      const findings = review([], [after]);
      expect(
        findings.filter((f) => f.category === 'PERSISTENT_PLAINTEXT_SECRET'),
      ).toHaveLength(1);
    });

    it('does NOT flag a plain VAR_GLOBAL (no retain) of a secret name', async () => {
      const after = await parseSource(
        `VAR_GLOBAL
    sAdminPassword : STRING;
END_VAR
`,
        'secrets.st',
      );
      const findings = review([], [after]);
      expect(
        findings.filter((f) => f.category === 'PERSISTENT_PLAINTEXT_SECRET'),
      ).toHaveLength(0);
    });

    it('does NOT flag a PERSISTENT global with a non-secret name', async () => {
      const after = await parseSource(
        `VAR_GLOBAL PERSISTENT
    iCycleCount : INT;
END_VAR
`,
        'state.st',
      );
      const findings = review([], [after]);
      expect(
        findings.filter((f) => f.category === 'PERSISTENT_PLAINTEXT_SECRET'),
      ).toHaveLength(0);
    });
  });
});
