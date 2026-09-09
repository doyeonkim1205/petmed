// Node 내장 테스트 러너 (node --test). 추가 의존성 없음 — Node 24 네이티브 TS 실행.
// 실행: `npm test` (= node --test src/lib/revenuecat.test.ts)
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { isRcPlatform, rcPublicKeyFor } from './revenuecat.ts';

describe('isRcPlatform (입력검증)', () => {
  it('ios / android 만 통과', () => {
    assert.equal(isRcPlatform('ios'), true);
    assert.equal(isRcPlatform('android'), true);
  });

  it('그 외 값(web·대문자·빈값·null·객체 등)은 거부', () => {
    for (const v of ['web', 'IOS', 'Android', '', ' ios', null, undefined, 0, 1, {}, ['ios']]) {
      assert.equal(isRcPlatform(v), false);
    }
  });
});

describe('rcPublicKeyFor (플랫폼별 Public 키 선택)', () => {
  const APPLE = 'NEXT_PUBLIC_REVENUECAT_APPLE_API_KEY';
  const GOOGLE = 'NEXT_PUBLIC_REVENUECAT_GOOGLE_API_KEY';
  let savedApple: string | undefined;
  let savedGoogle: string | undefined;

  beforeEach(() => {
    savedApple = process.env[APPLE];
    savedGoogle = process.env[GOOGLE];
    process.env[APPLE] = 'appl_TESTKEY';
    process.env[GOOGLE] = 'goog_TESTKEY';
  });

  afterEach(() => {
    if (savedApple === undefined) delete process.env[APPLE];
    else process.env[APPLE] = savedApple;
    if (savedGoogle === undefined) delete process.env[GOOGLE];
    else process.env[GOOGLE] = savedGoogle;
  });

  it('ios → Apple Public 키', () => {
    assert.equal(rcPublicKeyFor('ios'), 'appl_TESTKEY');
  });

  it('android → Google Public 키', () => {
    assert.equal(rcPublicKeyFor('android'), 'goog_TESTKEY');
  });

  it('해당 플랫폼 키가 env 에 없으면 undefined (→ 호출부 503 폴백)', () => {
    delete process.env[APPLE];
    assert.equal(rcPublicKeyFor('ios'), undefined);
    // 다른 플랫폼 키가 있어도 교차 폴백하지 않는다.
    assert.equal(rcPublicKeyFor('android'), 'goog_TESTKEY');
  });
});
