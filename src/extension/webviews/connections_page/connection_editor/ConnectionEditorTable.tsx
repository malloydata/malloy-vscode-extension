import styled from 'styled-components';

export const ConnectionEditorTable = styled.table`
  b.connection-title {
    color: var(--foreground);
    font-family: var(--font-family);
    display: flex;
    align-items: center;
  }

  .connection-editor-box {
    margin: 10px;
    background-color: var(--vscode-list-hoverBackground);
    padding: 10px;
    border: 1px solid var(--vscode-contrastBorder);
  }

  .button-group {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  td.label-cell {
    width: 200px;
    text-align: right;
    vertical-align: top;
    padding: 6px 0px;
  }

  label {
    color: var(--foreground);
    cursor: pointer;
    font-family: var(--font-family);
    margin-inline-end: calc(var(--design-unit) * 2px + 2px);
    padding-inline-start: calc(var(--design-unit) * 2px + 2px);
  }
`;
