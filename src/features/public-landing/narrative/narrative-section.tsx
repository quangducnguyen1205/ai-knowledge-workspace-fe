import type { ReactNode } from 'react';
import { useTranslation } from '../../../shared/i18n';
import type { ChapterCopy } from './narrative-copy';

/**
 * One scroll chapter: a semantic section whose heading and copy stay ordinary HTML. In immersive
 * mode the section floats above the sticky scene; in static mode it also hosts its own visual.
 */
export function NarrativeSection({
  chapter,
  chapterNumber,
  align,
  visual,
  children,
}: {
  chapter: ChapterCopy;
  /** 1-based chapter number; chapter 1 is the hero and renders outside this component. */
  chapterNumber: number;
  align: 'start' | 'end' | 'center';
  /** Static-mode illustration; omitted while the WebGL scene carries the visuals. */
  visual?: ReactNode;
  children?: ReactNode;
}) {
  const { t } = useTranslation('landing');
  const headingId = `me-chapter-title-${chapterNumber}`;

  return (
    <section
      id={`me-chapter-${chapterNumber}`}
      className={`me-chapter me-chapter--${align}`}
      data-chapter={chapterNumber}
      aria-labelledby={headingId}
    >
      <div className="me-chapter__copy" data-reveal>
        <p className="me-eyebrow">{t(chapter.eyebrowKey)}</p>
        <h2 id={headingId}>{t(chapter.titleKey)}</h2>
        {chapter.bodyKeys.map((bodyKey) => (
          <p key={bodyKey} className="me-chapter__body">{t(bodyKey)}</p>
        ))}
        {children}
      </div>
      {visual}
    </section>
  );
}
