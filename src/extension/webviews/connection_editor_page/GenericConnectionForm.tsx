/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as React from 'react';
import {useState} from 'react';
import {
  VSCodeButton,
  VSCodeCheckbox,
  VSCodeDivider,
  VSCodeTextField,
} from '@vscode/webview-ui-toolkit/react';
import styled from 'styled-components';
import {ConnectionPropertyInfo} from '../../../common/types/message_types';

interface GenericConnectionFormProps {
  name: string;
  setName: (name: string) => void;
  typeName: string;
  typeDisplayName: string;
  properties: ConnectionPropertyInfo[];
  values: Record<string, string | number | boolean>;
  onValueChange: (propName: string, value: string | number | boolean) => void;
  existingNames: string[];
  registeredTypes: string[];
  isNew: boolean;
  readonly?: boolean;
  onSave: () => void;
  onDelete: () => void;
  onCancel: () => void;
  onDuplicate: () => void;
  onTest: () => void;
  onRequestFile: (propName: string, filters: Record<string, string[]>) => void;
  testStatus: 'idle' | 'waiting' | 'success' | 'error';
  testError: string;
}

export const GenericConnectionForm = ({
  name,
  setName,
  typeName,
  typeDisplayName,
  properties,
  values,
  onValueChange,
  existingNames,
  registeredTypes,
  isNew,
  readonly: isReadonly,
  onSave,
  onDelete,
  onCancel,
  onDuplicate,
  onTest,
  onRequestFile,
  testStatus,
  testError,
}: GenericConnectionFormProps) => {
  const nameError = isReadonly
    ? null
    : validateName(name, existingNames, registeredTypes, typeName);
  const isValid = name.trim() !== '' && !nameError;

  return (
    <FormContainer>
      <FormHeader>
        <TypeBadge>{typeDisplayName}</TypeBadge>
        {isReadonly && <ReadonlyBadge>Read-only (config file)</ReadonlyBadge>}
      </FormHeader>

      <FieldGroup>
        <FieldLabel>Connection Name</FieldLabel>
        <VSCodeTextField
          value={name}
          onInput={e => setName(inputValue(e))}
          placeholder="Enter connection name"
          readOnly={isReadonly}
          style={{width: '100%'}}
        />
        {nameError && <ErrorText>{nameError}</ErrorText>}
      </FieldGroup>

      <VSCodeDivider />

      {properties.map(prop => (
        <PropertyField
          key={prop.name}
          property={prop}
          value={values[prop.name]}
          onChange={value => onValueChange(prop.name, value)}
          onRequestFile={onRequestFile}
          readonly={isReadonly}
        />
      ))}

      <VSCodeDivider />

      <ActionBar>
        <LeftButtons>
          <VSCodeButton appearance="secondary" onClick={onCancel}>
            {isReadonly ? 'Close' : 'Cancel'}
          </VSCodeButton>
          {!isReadonly && !isNew && (
            <VSCodeButton appearance="secondary" onClick={onDuplicate}>
              Duplicate
            </VSCodeButton>
          )}
          {!isReadonly && !isNew && (
            <VSCodeButton appearance="secondary" onClick={onDelete}>
              Delete
            </VSCodeButton>
          )}
        </LeftButtons>
        <RightButtons>
          <VSCodeButton
            onClick={onTest}
            disabled={!isValid || testStatus === 'waiting'}
          >
            {testStatus === 'waiting' ? 'Testing...' : 'Test'}
          </VSCodeButton>
          {!isReadonly && (
            <VSCodeButton onClick={onSave} disabled={!isValid}>
              Save
            </VSCodeButton>
          )}
        </RightButtons>
      </ActionBar>

      {testStatus === 'success' && (
        <TestResultArea>
          <TestSuccessText>Connection Test Passed.</TestSuccessText>
        </TestResultArea>
      )}

      {testStatus === 'error' && (
        <TestResultArea>
          <TestErrorLabel>
            {testError && testError !== 'Something went wrong'
              ? 'Connection Test Failed:'
              : 'Connection Test Failed'}
          </TestErrorLabel>
          {testError && testError !== 'Something went wrong' && (
            <TestErrorBox>{testError}</TestErrorBox>
          )}
        </TestResultArea>
      )}
    </FormContainer>
  );
};

function validateName(
  name: string,
  existingNames: string[],
  registeredTypes: string[],
  currentTypeName: string
): string | null {
  if (name.trim() === '') return null; // Empty shows no error (just disables buttons)
  if (existingNames.includes(name)) {
    return `A connection named "${name}" already exists.`;
  }
  if (registeredTypes.includes(name) && name !== currentTypeName) {
    return `The name "${name}" is reserved for ${name}-type connections.`;
  }
  return null;
}

interface PropertyFieldProps {
  property: ConnectionPropertyInfo;
  value: string | number | boolean | undefined;
  onChange: (value: string | number | boolean) => void;
  onRequestFile: (propName: string, filters: Record<string, string[]>) => void;
  readonly?: boolean;
}

const PropertyField = ({
  property,
  value,
  onChange,
  onRequestFile,
  readonly: isReadonly,
}: PropertyFieldProps) => {
  const placeholder = property.optional ? 'Optional' : undefined;

  switch (property.type) {
    case 'boolean':
      return (
        <InlineField>
          <InlineLabel>{property.displayName}</InlineLabel>
          <InlineControl>
            <VSCodeCheckbox
              checked={value === true}
              onChange={e => onChange(inputChecked(e))}
              disabled={isReadonly}
            />
          </InlineControl>
        </InlineField>
      );

    case 'password':
    case 'secret':
      return (
        <InlineField>
          <InlineLabel>{property.displayName}</InlineLabel>
          <InlineControl>
            {isReadonly ? (
              <SecretIndicator>
                {value ? 'Secret is set' : 'Not set'}
              </SecretIndicator>
            ) : (
              <SecretField
                value={typeof value === 'string' ? value : ''}
                onChange={v => onChange(v)}
              />
            )}
          </InlineControl>
        </InlineField>
      );

    case 'file':
      return (
        <InlineField>
          <InlineLabel>{property.displayName}</InlineLabel>
          <InlineControl>
            <FileRow>
              <VSCodeTextField
                value={typeof value === 'string' ? value : ''}
                onInput={e => onChange(inputValue(e))}
                placeholder={placeholder}
                readOnly={isReadonly}
                style={{flex: 1}}
              />
              {!isReadonly && (
                <VSCodeButton
                  appearance="secondary"
                  onClick={() =>
                    onRequestFile(property.name, property.fileFilters ?? {})
                  }
                >
                  Browse...
                </VSCodeButton>
              )}
            </FileRow>
          </InlineControl>
        </InlineField>
      );

    case 'text':
      return (
        <FieldGroup>
          <FieldLabel>{property.displayName}</FieldLabel>
          <TextArea
            value={typeof value === 'string' ? value : ''}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            readOnly={isReadonly}
            rows={4}
          />
          {property.description && <HelpText>{property.description}</HelpText>}
        </FieldGroup>
      );

    case 'number':
      return (
        <InlineField>
          <InlineLabel>{property.displayName}</InlineLabel>
          <InlineControl>
            <VSCodeTextField
              value={value !== undefined ? String(value) : ''}
              onInput={e => {
                const v = inputValue(e);
                const num = Number(v);
                onChange(isNaN(num) ? v : num);
              }}
              placeholder={placeholder}
              readOnly={isReadonly}
              style={{width: '100%'}}
            />
          </InlineControl>
        </InlineField>
      );

    case 'string':
    default:
      return (
        <InlineField>
          <InlineLabel>{property.displayName}</InlineLabel>
          <InlineControl>
            <VSCodeTextField
              value={
                typeof value === 'string'
                  ? value
                  : value !== undefined
                  ? String(value)
                  : ''
              }
              onInput={e => onChange(inputValue(e))}
              placeholder={placeholder}
              readOnly={isReadonly}
              style={{width: '100%'}}
            />
          </InlineControl>
        </InlineField>
      );
  }
};

interface SecretFieldProps {
  value: string;
  onChange: (value: string) => void;
}

const SecretField = ({value, onChange}: SecretFieldProps) => {
  const [showSecret, setShowSecret] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  if (editing) {
    return (
      <Column>
        <VSCodeTextField
          value={draft}
          onInput={e => setDraft(inputValue(e))}
          type={showSecret ? 'text' : 'password'}
          style={{width: '100%'}}
        />
        <ButtonRow>
          <VSCodeButton
            onClick={() => {
              onChange(draft);
              setEditing(false);
            }}
          >
            {value ? 'Change' : 'Set'}
          </VSCodeButton>
          <VSCodeButton
            appearance="secondary"
            onClick={() => setEditing(false)}
          >
            Cancel
          </VSCodeButton>
          <VSCodeCheckbox
            checked={showSecret}
            onChange={e => setShowSecret(inputChecked(e))}
          >
            Show
          </VSCodeCheckbox>
        </ButtonRow>
      </Column>
    );
  }

  return (
    <ButtonRow>
      <VSCodeButton
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
      >
        {value ? 'Change' : 'Set'}
      </VSCodeButton>
      {value && (
        <VSCodeButton appearance="secondary" onClick={() => onChange('')}>
          Clear
        </VSCodeButton>
      )}
      {value && <SecretIndicator>Secret is set</SecretIndicator>}
    </ButtonRow>
  );
};

const FormContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px 0;
`;

const FormHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const TypeBadge = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: var(--vscode-foreground);
`;

const ReadonlyBadge = styled.span`
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
  font-style: italic;
`;

const InlineField = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const InlineLabel = styled.label`
  font-size: 12px;
  font-weight: 600;
  color: var(--vscode-foreground);
  min-width: 140px;
  flex-shrink: 0;
`;

const InlineControl = styled.div`
  flex: 1;
  min-width: 0;
`;

const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const FieldLabel = styled.label`
  font-size: 12px;
  font-weight: 600;
  color: var(--vscode-foreground);
`;

const HelpText = styled.span`
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
`;

const ErrorText = styled.span`
  font-size: 12px;
  color: var(--vscode-errorForeground);
`;

const TestResultArea = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
`;

const TestSuccessText = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: var(--vscode-testing-iconPassed, #73c991);
`;

const TestErrorLabel = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: var(--vscode-errorForeground);
`;

const TestErrorBox = styled.div`
  background: var(--vscode-input-background);
  border: 1px solid var(--vscode-errorForeground);
  border-radius: 3px;
  padding: 8px 10px;
  font-size: 12px;
  color: var(--vscode-errorForeground);
  white-space: pre-wrap;
  word-break: break-word;
`;

const ActionBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
`;

const LeftButtons = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const RightButtons = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ButtonRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const FileRow = styled.div`
  display: flex;
  gap: 4px;
  align-items: center;
`;

const Column = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const TextArea = styled.textarea`
  width: 100%;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border);
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  padding: 6px;
  resize: vertical;
  &:focus {
    outline: 1px solid var(--vscode-focusBorder);
  }
`;

const SecretIndicator = styled.span`
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
  font-style: italic;
`;

/**
 * Extract the string value from a VS Code webview-ui-toolkit custom element
 * event. The toolkit's custom elements (VSCodeTextField, VSCodeCheckbox, etc.)
 * fire standard DOM events whose `target` is the custom element itself.
 * The element exposes `.value` and `.checked` properties, but TypeScript only
 * sees `EventTarget`. This helper avoids scattering `as HTMLInputElement`
 * across every handler.
 */
function inputValue(event: {target: EventTarget | null}): string {
  return (event.target as {value?: string})?.value ?? '';
}

function inputChecked(event: {target: EventTarget | null}): boolean {
  return (event.target as {checked?: boolean})?.checked ?? false;
}
