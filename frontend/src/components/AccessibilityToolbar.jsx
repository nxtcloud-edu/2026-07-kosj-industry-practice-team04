import { useLayoutEffect, useState } from 'react';

/**
 * 접근성 화면 설정 — 글자 크기 + 화면 모드
 * ─────────────────────────────────────────────────────
 * 화면 모드를 '고대비 켜기/끄기' 하나로 두면, 눈부심이 싫어 어두운 화면을
 * 원하는 사용자까지 형광 노랑 고대비를 써야 한다. 두 요구는 목적이 다르므로
 * 분리한다 (멘토 피드백 7/28):
 *   기본   — 종이빛 라이트
 *   다크   — 눈이 편한 어두운 화면 (저조도·야간용, 눈부심 최소)
 *   고대비 — 저시력 사용자용 최대 대비 (경계선·앰버 강조)
 *
 * 실제 색은 index.css의 html[data-theme] 변수들이 전부 담당한다.
 */

const STORAGE_KEY = 'moa-accessibility-settings';
const FONT_SCALES = [100, 120, 140, 160];
const THEMES = [
  { key: 'light', label: '기본', icon: '☀', desc: '밝은 화면' },
  { key: 'dark', label: '다크', icon: '☾', desc: '눈이 편한 어두운 화면' },
  { key: 'contrast', label: '고대비', icon: '◑', desc: '저시력용 최대 대비' },
];
const DEFAULT_SETTINGS = { fontScale: 100, theme: 'light' };

function normalizeFontScale(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;

  return FONT_SCALES.reduce((nearest, candidate) =>
    Math.abs(candidate - numericValue) <= Math.abs(nearest - numericValue) ? candidate : nearest,
  );
}

function loadSettings() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    const savedScale = saved?.fontScale == null ? null : normalizeFontScale(saved.fontScale);

    // 예전 저장값(highContrast/darkMode 불리언)을 새 3단 모드로 옮긴다.
    const theme = THEMES.some((t) => t.key === saved?.theme)
      ? saved.theme
      : (saved?.highContrast === true || saved?.darkMode === true ? 'contrast' : 'light');

    return {
      fontScale: savedScale ?? (saved?.largeText === true ? 140 : 100),
      theme,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export default function AccessibilityToolbar() {
  const [settings, setSettings] = useState(loadSettings);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.fontScale = String(settings.fontScale);
    // 색은 data-theme 하나로 갈린다 — 기본(light)은 :root 값을 그대로 쓴다.
    if (settings.theme === 'light') delete root.dataset.theme;
    else root.dataset.theme = settings.theme;
    root.classList.remove('a11y-large-text', 'a11y-dark-mode', 'a11y-high-contrast');

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // 저장 공간을 사용할 수 없어도 현재 화면의 설정은 유지한다.
    }
  }, [settings]);

  const changeFontScale = (direction) => {
    setSettings((current) => {
      const currentIndex = FONT_SCALES.indexOf(current.fontScale);
      const nextIndex = Math.min(Math.max(currentIndex + direction, 0), FONT_SCALES.length - 1);
      return { ...current, fontScale: FONT_SCALES[nextIndex] };
    });
  };

  return (
    <section className="accessibility-bar" aria-label="접근성 화면 설정">
      <div className="accessibility-controls" role="group" aria-label="화면 보기 설정">
        <strong className="accessibility-heading">화면 보기</strong>

        <div className="font-size-control" role="group" aria-label="글자 크기 조절">
          <span className="font-size-label">글자 크기</span>
          <button
            type="button"
            className="font-size-step"
            aria-label="글자 크기 한 단계 줄이기"
            disabled={settings.fontScale === FONT_SCALES[0]}
            onClick={() => changeFontScale(-1)}
          >
            −
          </button>
          <output className="font-size-value" aria-live="polite" aria-label={`현재 글자 크기 ${settings.fontScale}%`}>
            {settings.fontScale}%
          </output>
          <button
            type="button"
            className="font-size-step"
            aria-label="글자 크기 한 단계 키우기"
            disabled={settings.fontScale === FONT_SCALES[FONT_SCALES.length - 1]}
            onClick={() => changeFontScale(1)}
          >
            +
          </button>
        </div>

        <div className="theme-control" role="radiogroup" aria-label="화면 모드">
          {THEMES.map((t) => (
            <button
              key={t.key}
              type="button"
              role="radio"
              aria-checked={settings.theme === t.key}
              className={`theme-option ${settings.theme === t.key ? 'is-active' : ''}`}
              title={t.desc}
              onClick={() => setSettings((cur) => ({ ...cur, theme: t.key }))}
            >
              <span className="theme-option__icon" aria-hidden="true">{t.icon}</span>
              <span className="theme-option__label">{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
