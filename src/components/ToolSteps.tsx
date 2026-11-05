import type { Strings } from '../i18n';
import type { ToolStep } from '../types';

interface ToolStepsProps {
  steps: ToolStep[];
  strings: Strings;
}

function compact(value: unknown): string {
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value));
    } catch {
      return value;
    }
  }
  return JSON.stringify(value);
}

/**
 * The visible half of tool calling: which tool the model asked for, with what
 * arguments, and what came back. Showing this is the point — an answer that
 * says "$600" is only trustworthy if the reader can see where $600 came from.
 */
export function ToolSteps({ steps, strings }: ToolStepsProps) {
  if (steps.length === 0) return null;
  const t = strings.tools;
  return (
    <ol className="steps" aria-label={t.toggle}>
      {steps.map((step) => (
        <li key={step.id} className={`step step--${step.status}`}>
          <div className="step__head">
            <span className="step__name">{t.names[step.name] ?? step.name}</span>
            <code className="step__fn" dir="ltr">
              {step.name}({compact(step.args)})
            </code>
            {step.status === 'running' ? <span className="step__state">{t.running}</span> : null}
            {step.status === 'error' ? <span className="step__state">{t.failed}</span> : null}
          </div>
          {step.result !== undefined ? (
            <code className="step__result" dir="ltr">
              → {compact(step.result)}
            </code>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
