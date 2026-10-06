import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeUrl,
  parseStored,
  formatBookmark,
  generateSlug,
  createBookmark,
  loadBookmarks,
} from '../src/lib/bookmarks.ts';

test('URL with and without https:// normalises to the same value', () => {
  const a = normalizeUrl('www.example.com');
  const b = normalizeUrl('https://www.example.com');
  assert.equal(a, 'https://www.example.com');
  assert.equal(a, b);
  assert.equal(normalizeUrl('  example.com/path?q=1 '), 'https://example.com/path?q=1');
});

test('invalid or unsafe URLs are rejected', () => {
  for (const bad of ['', '   ', 'javascript:alert(1)', 'ftp://x.com', 'not a url', null, 42]) {
    assert.equal(normalizeUrl(bad), null);
  }
});

test('loading recovers from empty, corrupted, legacy and non-array values', () => {
  assert.deepEqual(parseStored(null), []);
  assert.deepEqual(parseStored(''), []);
  assert.deepEqual(parseStored('{not json'), []);
  assert.deepEqual(parseStored('{"url":"a","slug":"mona-1"}'), []);
  assert.deepEqual(parseStored('"hello"'), []);
  assert.deepEqual(parseStored('null'), []);
  assert.deepEqual(parseStored('[1,null,{"url":5,"slug":"x"},{"url":"https://a.com"},[]]'), []);

  const legacy = parseStored('["example.com"]');
  assert.equal(legacy.length, 1);
  assert.equal(legacy[0].url, 'https://example.com');
  assert.match(legacy[0].slug, /^mona-[0-9A-Za-z]{4}$/);

  const mixed = parseStored('[{"url":"https://a.com","slug":"mona-7fk2"},{"bad":true}]');
  assert.deepEqual(mixed, [{ url: 'https://a.com', slug: 'mona-7fk2' }]);
});

test('loadBookmarks does not throw when storage throws', () => {
  const broken = {
    getItem() { throw new Error('denied'); },
    setItem() {},
    removeItem() {},
  };
  assert.deepEqual(loadBookmarks(broken), []);
  assert.deepEqual(loadBookmarks(undefined), []);
});

test('bookmark formats as "<url> :: <slug>"', () => {
  assert.equal(
    formatBookmark({ url: 'https://www.example.com', slug: 'mona-7fk2' }),
    'https://www.example.com :: mona-7fk2',
  );
});

test('slugs have mona- prefix and base62 body; createBookmark normalises', () => {
  assert.match(generateSlug(), /^mona-[0-9A-Za-z]{4}$/);
  const b = createBookmark('example.com', []);
  assert.equal(b?.url, 'https://example.com');
  assert.equal(createBookmark('bad url', []), null);
});
