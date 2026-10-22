import { keywordMatches, validateGraph, Graph } from '../src/schemas';
import { encrypt, decrypt, signed, hash, csv } from '../src/core';
import { eligibleDate } from '../src/policy';
import { createHmac } from 'node:crypto';
describe('Policy boundaries', () => {
  test('matches normalized case-insensitive keywords without regular expressions', () => {
    expect(keywordMatches('  ＧＵＩＤＥ  ', ['guide'], 'EXACT')).toBe(true);
    expect(keywordMatches('please send my guide', ['GUIDE'], 'CONTAINS')).toBe(true);
    expect(keywordMatches('please send guide', ['guide'], 'EXACT')).toBe(false);
    expect(keywordMatches('abc', ['.*'], 'CONTAINS')).toBe(false);
  });
  test('rejects missing, future and expired comment timestamps', () => {
    const now = new Date('2026-10-22T12:00:00Z');
    expect(eligibleDate(new Date('2026-10-22T11:00:00Z'), now)).toBe(true);
    expect(eligibleDate(new Date('2026-10-15T12:00:00Z'), now)).toBe(false);
    expect(eligibleDate(new Date('2026-10-23T12:00:00Z'), now)).toBe(false);
    expect(eligibleDate(new Date('invalid'), now)).toBe(false);
  });
  test('authenticates encrypted tokens and detects tampering', () => {
    process.env.TOKEN_ENCRYPTION_KEY = 'a'.repeat(64);
    const encrypted = encrypt('secret-instagram-token');
    expect(encrypted).not.toContain('secret-instagram-token');
    expect(decrypt(encrypted)).toBe('secret-instagram-token');
    const parts = encrypted.split('.');
    parts[2] = (parts[2][0] === '0' ? '1' : '0') + parts[2].slice(1);
    expect(() => decrypt(parts.join('.'))).toThrow();
  });
  test('validates signatures on exact raw bytes', () => {
    const raw = Buffer.from('{"event":"ok"}');
    const sig = createHmac('sha256', 'secret').update(raw).digest('hex');
    expect(signed(raw, sig, 'secret')).toBe(true);
    expect(signed(Buffer.from('{ "event":"ok"}'), sig, 'secret')).toBe(false);
    expect(signed(raw, 'short', 'secret')).toBe(false);
  });
  test('neutralizes spreadsheet formula injection in CSV', () => {
    expect(csv([{ name: '=HYPERLINK("bad")', email: 'safe@example.com' }])).toContain(
      '"\'=HYPERLINK(""bad"")"',
    );
  });
});
describe('Workflow validation', () => {
  const graph: Graph = {
    nodes: [
      { id: 'start', type: 'leadCreated', position: { x: 0, y: 0 }, data: { label: 'Start' } },
      { id: 'end', type: 'end', position: { x: 0, y: 100 }, data: { label: 'End' } },
    ],
    edges: [{ id: '1', source: 'start', target: 'end' }],
  };
  test('accepts bounded valid graphs', () => expect(validateGraph(graph)).toEqual([]));
  test('rejects cycles and incoming trigger connections', () => {
    const g = { ...graph, edges: [...graph.edges, { id: '2', source: 'end', target: 'start' }] };
    expect(validateGraph(g)).toContain('Workflow contains a loop');
    expect(validateGraph(g)).toContain('Triggers cannot have incoming connections');
  });
  test('rejects disconnected nodes', () => {
    const g = {
      ...graph,
      nodes: [
        ...graph.nodes,
        { id: 'orphan', type: 'end' as const, position: { x: 0, y: 0 }, data: { label: 'Orphan' } },
      ],
    };
    expect(validateGraph(g)).toContain('Every node must be reachable from the trigger');
  });
  test('rejects invalid branch handles', () => {
    const g: Graph = {
      nodes: [
        graph.nodes[0],
        { id: 'branch', type: 'hasConsent', position: { x: 0, y: 20 }, data: { label: 'Consent' } },
        graph.nodes[1],
      ],
      edges: [
        { id: 'a', source: 'start', target: 'branch' },
        { id: 'b', source: 'branch', target: 'end' },
      ],
    };
    expect(validateGraph(g)).toContain('Conditions require one yes and one no branch');
  });
});
