/*
 * Copyright 2024 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {LitElement, TemplateResult, css, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {until} from 'lit/directives/until.js';
import {
  provideVSCodeDesignSystem,
  vsCodeButton,
  vsCodeDropdown,
  vsCodeOption,
  vsCodeTextField,
} from '@vscode/webview-ui-toolkit';
import {QueryDownloadOptions} from '../../../common/types/message_types';
import {
  CSVWriter,
  DataWriter,
  JSONWriter,
  Result,
  WriteStream,
} from '@malloydata/malloy';

const styles = css`
  .form {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .form-row {
    display: flex;
  }
`;

provideVSCodeDesignSystem().register(
  vsCodeButton(),
  vsCodeTextField(),
  vsCodeDropdown(),
  vsCodeOption()
);

class MemoryWriteStream implements WriteStream {
  _data: string[] = [];

  write(data: string) {
    this._data.push(data);
  }

  close() {}

  get data(): string {
    return this._data.join('');
  }
}

@customElement('download-form')
export class DownloadForm extends LitElement {
  static override styles = [styles];

  @property()
  name? = 'malloy';

  @property({type: Object})
  result!: Result;

  @property()
  onDownload!: (options: QueryDownloadOptions) => Promise<void>;

  @property({type: Boolean})
  canStream!: boolean;

  @property({attribute: false})
  format: 'json' | 'csv' = 'json';

  @property()
  onClose!: () => void;

  rowLimit = 1000;

  @property({attribute: false})
  amount: 'current' | 'all' | number = 'current';

  href: string | null = null;

  /**
   * Creates a link element that contains a download button, which
   * when clicked will initiate a download of the current result set.
   * This current targets only the browser version, and does not
   * support streaming.
   *
   * @returns Link element template
   */
  async buildDownloadHref(): Promise<TemplateResult> {
    const writeStream = new MemoryWriteStream();
    let writer: DataWriter;
    let type: string;
    let download: string;
    if (this.format === 'json') {
      writer = new JSONWriter(writeStream);
      type = 'text/json';
      download = `${this.name}.json`;
    } else {
      writer = new CSVWriter(writeStream);
      type = 'text/csv';
      download = `${this.name}.csv`;
    }
    const rowStream = this.result.data.inMemoryStream();
    await writer.process(rowStream);
    writeStream.close();

    // Dereference any existing blob
    if (this.href) {
      window.URL.revokeObjectURL(this.href);
    }
    // Create a new blob with our data
    const blob = new Blob([writeStream.data], {type});
    this.href = window.URL.createObjectURL(blob);

    return html`<a href=${this.href} download=${download} @click=${this.onClose}
      ><vscode-button>Download</vscode-button></a
    >`;
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    if (this.href) {
      window.URL.revokeObjectURL(this.href);
    }
  }

  override render() {
    let buttonPromise: Promise<TemplateResult> | undefined;
    if (!this.canStream) {
      buttonPromise = this.buildDownloadHref();
    }

    const options = this.canStream
      ? [
          {value: 'current', label: 'Current result set'},
          {value: 'all', label: 'All results'},
          {value: 'rows', label: 'Limited rows'},
        ]
      : [{value: 'current', label: 'Current result set'}];

    return html` <div class="form">
      <div class="form-row">
        <vscode-dropdown
          value=${this.format}
          @change=${({target: {value}}: {target: HTMLInputElement}) =>
            (this.format = value as 'json' | 'csv')}
          style="width: 100%"
        >
          <vscode-option value="json">JSON</vscode-option>
          <vscode-option value="csv">CSV</vscode-option>
        </vscode-dropdown>
      </div>
      ${
        !this.canStream
          ? html`<div
              class="form-row"
              @click=${(event: MouseEvent) => event.stopPropagation()}
            >
              ${until(buttonPromise)}
            </div>`
          : html`<div class="form-row">
                <vscode-dropdown
                  value=${typeof this.amount === 'number'
                    ? 'rows'
                    : this.amount}
                  @change=${({target: {value}}: {target: HTMLInputElement}) => {
                    if (value === 'current' || value === 'all') {
                      this.amount = value;
                    } else {
                      this.amount = this.rowLimit;
                    }
                  }}
                  style="width: 100%"
                >
                  ${options.map(
                    option =>
                      html`<vscode-option value=${option.value}
                        >${option.label}</vscode-option
                      >`
                  )}
                </vscode-dropdown>
              </div>
              ${typeof this.amount === 'number'
                ? html`<div class="form-row">
                    <vscode-text-field
                      value=${this.rowLimit.toString()}
                      @change=${({
                        target: {value},
                      }: {
                        target: HTMLInputElement;
                      }) => {
                        const parsed = parseInt(value);
                        if (!Number.isNaN(parsed)) {
                          this.rowLimit = parsed;
                          this.amount = parsed;
                        }
                      }}
                      style="width: 100%"
                    ></vscode-text-field>
                  </div>`
                : null}
              <div class="form-row">
                <vscode-button
                  @click=${() =>
                    this.onDownload({format: this.format, amount: this.amount})}
                >
                  Download
                </vscode-button>
              </div>`
      }
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'download-form': DownloadForm;
  }
}
