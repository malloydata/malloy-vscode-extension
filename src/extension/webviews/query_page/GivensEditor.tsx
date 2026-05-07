/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as React from 'react';
import {useEffect, useState} from 'react';
import styled from 'styled-components';
import type {GivenValue} from '@malloydata/malloy';
import {GivenInfo} from '../../../common/types/message_types';

export interface GivensEditorProps {
  givens: GivenInfo[];
  onRun: (values: Record<string, GivenValue>) => void;
}

/**
 * Form-style editor for the givens this query references. One row per
 * given. Empty fields are omitted from the values map so the upstream
 * default (declaration default, runtime config, finalize, etc.) wins —
 * we only override what the user explicitly types.
 */
export function GivensEditor({givens, onRun}: GivensEditorProps) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    initialValues(givens)
  );

  // Reseed from each run's reported values so a re-run reflects what
  // was actually used (and a different query swaps the form).
  useEffect(() => {
    setValues(initialValues(givens));
  }, [givens]);

  const setValue = (name: string, raw: string) => {
    setValues(prev => ({...prev, [name]: raw}));
  };

  const handleRun = () => {
    const out: Record<string, GivenValue> = {};
    for (const g of givens) {
      const raw = values[g.name];
      if (raw === undefined || raw === '') continue;
      const parsed = parseValue(raw, g.kind);
      out[g.name] = parsed;
    }
    onRun(out);
  };

  return (
    <StyledEditor>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {givens.map(g => (
            <tr key={g.name}>
              <td className="name">{g.name}</td>
              <td className="kind">
                {g.kind}
                {g.hasDefault ? (
                  <span className="hint"> (has default)</span>
                ) : null}
              </td>
              <td>{renderInput(g, values[g.name] ?? '', setValue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="actions">
        <button className="run" onClick={handleRun}>
          Run with these values
        </button>
      </div>
    </StyledEditor>
  );
}

function initialValues(givens: GivenInfo[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const g of givens) {
    out[g.name] = stringifyValue(g.currentValue);
  }
  return out;
}

function stringifyValue(v: GivenValue | undefined): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return v;
  if (
    typeof v === 'number' ||
    typeof v === 'boolean' ||
    typeof v === 'bigint'
  ) {
    return String(v);
  }
  if (v instanceof Date) return v.toISOString();
  return JSON.stringify(v);
}

function parseValue(raw: string, kind: string): GivenValue {
  switch (kind) {
    case 'number':
      return Number(raw);
    case 'boolean':
      return raw === 'true' || raw === '1';
    case 'string':
    case 'date':
    case 'timestamp':
    case 'timestamptz':
    case 'filter expression':
      return raw;
    default:
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
  }
}

function renderInput(
  g: GivenInfo,
  value: string,
  setValue: (name: string, raw: string) => void
) {
  if (g.kind === 'boolean') {
    return (
      <select value={value} onChange={e => setValue(g.name, e.target.value)}>
        <option value="">(default)</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }
  if (g.kind === 'number') {
    return (
      <input
        type="number"
        value={value}
        onChange={e => setValue(g.name, e.target.value)}
      />
    );
  }
  if (g.kind === 'date') {
    return (
      <input
        type="text"
        placeholder="YYYY-MM-DD"
        value={value}
        onChange={e => setValue(g.name, e.target.value)}
      />
    );
  }
  if (g.kind === 'array' || g.kind === 'record') {
    return (
      <textarea
        rows={3}
        placeholder="JSON"
        value={value}
        onChange={e => setValue(g.name, e.target.value)}
      />
    );
  }
  return (
    <input
      type="text"
      value={value}
      onChange={e => setValue(g.name, e.target.value)}
    />
  );
}

const StyledEditor = styled.div`
  padding: 12px;
  font-size: 12px;
  color: var(--vscode-foreground);

  table {
    width: 100%;
    border-collapse: collapse;
  }
  th,
  td {
    text-align: left;
    padding: 6px 8px;
    border-bottom: 1px solid var(--vscode-panel-border);
    vertical-align: middle;
  }
  th {
    font-weight: 500;
    color: var(--vscode-descriptionForeground);
  }
  .name {
    font-family: var(--vscode-editor-font-family, monospace);
    font-weight: 500;
  }
  .kind {
    color: var(--vscode-descriptionForeground);
  }
  .hint {
    font-style: italic;
    opacity: 0.7;
  }
  input,
  select,
  textarea {
    width: 100%;
    box-sizing: border-box;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    padding: 4px 6px;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 12px;
  }
  textarea {
    resize: vertical;
  }
  .actions {
    margin-top: 12px;
    display: flex;
    justify-content: flex-end;
  }
  .run {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    padding: 6px 14px;
    cursor: pointer;
    font-size: 12px;
  }
  .run:hover {
    background: var(--vscode-button-hoverBackground);
  }
`;
