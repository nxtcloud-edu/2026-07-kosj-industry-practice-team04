import { useLayoutEffect, useState } from 'react';

const STORAGE_KEY = 'moa-accessibility-settings';
const FONT_SCALES = [100, 120, 140, 160];
const DEFAULT_SETTINGS = { fontScale: 100, highContrast: false };

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

    return {
      fontScale: savedScale ?? (saved?.largeText === true ? 140 : 100),
      highContrast: saved?.highContrast === true || saved?.darkMode === true,
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
    root.classList.remove('a11y-large-text', 'a11y-dark-mode');
    root.classList.toggle('a11y-high-contrast', settings.highContrast);

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
        <button
          type="button"
          className="accessibility-toggle"
          aria-pressed={settings.highContrast}
          onClick={() => setSettings((current) => ({ ...current, highContrast: !current.highContrast }))}
        >
          <span className="accessibility-icon" aria-hidden="true">◐</span>
          <span>고대비</span>
          <span className="accessibility-state" aria-hidden="true">
            {settings.highContrast ? '켜짐' : '꺼짐'}
          </span>
        </button>
      </div>
    </section>
  );
}
