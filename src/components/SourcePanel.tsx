import { useEffect, useRef } from 'react';
import type { Strings } from '../i18n';
import type { SourceDoc } from '../types';

interface SourcePanelProps {
  sources: SourceDoc[];
  strings: Strings;
  activeIndex: number | null;
}

/**
 * The retrieval side of the answer. Every citation in the transcript points
 * here, so a reader can check a claim against the passage it came from instead
 * of trusting the model.
 */
export function SourcePanel({ sources, strings, activeIndex }: SourcePanelProps) {
  const activeRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (activeIndex !== null) {
      activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeIndex]);

  return (
    <aside className="sources">
      <h2 className="sources__title">{strings.sources}</h2>
      {sources.length === 0 ? (
        <p className="sources__empty">{strings.noSources}</p>
      ) : (
        <ol className="sources__list">
          {sources.map((source, i) => (
            <li
              key={source.id}
              ref={i === activeIndex ? activeRef : null}
              className={i === activeIndex ? 'source source--active' : 'source'}
            >
              <span className="source__number">{i + 1}</span>
              <div>
                {/* Each passage carries its own direction: an Arabic source
                    stays right-to-left even inside an English interface. */}
                <h3 className="source__title" dir="auto" lang={source.lang}>
                  {source.title}
                </h3>
                {source.match ? (
                  <p className="source__match">
                    {source.match.map((kind) => (
                      <span key={kind} className={`tag tag--${kind}`}>
                        {strings.semantic[kind]}
                      </span>
                    ))}
                  </p>
                ) : null}
                <p className="source__text" dir="auto" lang={source.lang}>
                  {source.text}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
