import { useId, useRef, type ReactNode } from "react";
import "./PartTabs.css";

export type PartTab = { key: string; label: string; /** Shown after the label, e.g. a warning mark. */ note?: string };

/**
 * One part at a time, chosen by tabs (WAI-ARIA tabs: arrow keys, Home and End
 * move between them). The panel shows the active part only.
 */
export function PartTabs({ tabs, active, onChange, label, children }: {
  tabs: readonly PartTab[];
  active: string;
  onChange: (key: string) => void;
  label: string;
  children: ReactNode;
}) {
  const id = useId();
  const list = useRef<HTMLDivElement>(null);
  const current = tabs.some((tab) => tab.key === active) ? active : tabs[0]?.key;
  const move = (index: number) => {
    const tab = tabs[(index + tabs.length) % tabs.length];
    onChange(tab.key);
    list.current?.querySelector<HTMLButtonElement>(`[data-key="${CSS.escape(tab.key)}"]`)?.focus();
  };
  return (
    <div className="part-tabs">
      <div ref={list} role="tablist" aria-label={label} className="part-tabs-list">
        {tabs.map((tab, index) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`${id}-tab-${index}`}
            data-key={tab.key}
            aria-selected={tab.key === current}
            aria-controls={`${id}-panel`}
            tabIndex={tab.key === current ? 0 : -1}
            className={`part-tabs-tab${tab.key === current ? " is-active" : ""}`}
            onClick={() => onChange(tab.key)}
            onKeyDown={(event) => {
              const keys: Record<string, number> = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 };
              if (event.key in keys) {
                event.preventDefault();
                move(keys[event.key]);
              }
            }}
          >
            {tab.label}
            {tab.note && <span className="part-tabs-note"> {tab.note}</span>}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-tab-${Math.max(0, tabs.findIndex((tab) => tab.key === current))}`}
        className="part-tabs-panel"
      >
        {children}
      </div>
    </div>
  );
}
