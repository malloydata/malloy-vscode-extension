/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import {useCallback, useEffect, useState} from 'react';
import {
  VSCodeButton,
  VSCodeDropdown,
  VSCodeOption,
  VSCodeTextField,
} from '@vscode/webview-ui-toolkit/react';
import {
  QueryDownloadCopyData,
  QueryDownloadOptions,
} from '../../../common/types/message_types';
import {
  CSVWriter,
  DataWriter,
  JSONWriter,
  Result,
  WriteStream,
} from '@malloydata/malloy';
import styled from 'styled-components';

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

interface DownloadFormProps {
  name?: string;
  result: Result;
  onDownload: (options: QueryDownloadOptions) => Promise<void>;
  onCopy: (options: QueryDownloadCopyData) => Promise<void>;
  canStream: boolean;
  onClose: () => void;
}

export function DownloadForm({
  name,
  result,
  onDownload,
  onCopy,
  onClose,
  canStream,
}: DownloadFormProps) {
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [rowLimit, setRowLimit] = useState(1000);
  const [amount, setAmount] = useState<'current' | 'all' | number>('current');
  const [href, setHref] = useState<string>();
  const [buttonElement, setButtonElement] = useState<JSX.Element>(
    <b>Loading...</b>
  );

  const createTextBlob =
    useCallback(async (): Promise<QueryDownloadCopyData> => {
      const writeStream = new MemoryWriteStream();
      let writer: DataWriter;
      let type: string;
      let download: string;
      if (format === 'json') {
        writer = new JSONWriter(writeStream);
        type = 'text/json';
        download = `${name}.json`;
      } else {
        writer = new CSVWriter(writeStream);
        type = 'text/csv';
        download = `${name}.csv`;
      }
      const rowStream = result.data.inMemoryStream();
      await writer.process(rowStream);
      writeStream.close();
      const data = writeStream.data;

      return {type, download, data};
    }, [format, name, result.data]);

  useEffect(() => {
    return () => {
      if (href) {
        window.URL.revokeObjectURL(href);
      }
    };
  }, [href]);

  const copyToClipboard = async () => {
    const options = await createTextBlob();
    await onCopy(options);
  };

  useEffect(() => {
    /**
     * Creates a link element that contains a download button, which
     * when clicked will initiate a download of the current result set.
     * This current targets only the browser version, and does not
     * support streaming.
     *
     * @returns Link element template
     */
    const buildDownloadHref = async () => {
      // Dereference any existing blob
      if (href) {
        window.URL.revokeObjectURL(href);
      }
      const {type, download, data} = await createTextBlob();

      // Create a new blob with our data
      const blob = new Blob([data], {type});
      setHref(window.URL.createObjectURL(blob));
      setButtonElement(
        <a href={href} download={download} onClick={onClose}>
          <VSCodeButton>Download</VSCodeButton>
        </a>
      );
    };

    if (!canStream) {
      buildDownloadHref();
    }
  }, [canStream, createTextBlob, href, onClose]);

  const options = canStream
    ? [
        {value: 'current', label: 'Current result set'},
        {value: 'all', label: 'All results'},
        {value: 'rows', label: 'Limited rows'},
      ]
    : [{value: 'current', label: 'Current result set'}];

  return (
    <Form>
      <div className="form-row">
        <VSCodeDropdown
          value={format}
          onChange={({target}) =>
            setFormat((target as HTMLInputElement).value as 'json' | 'csv')
          }
          style={{width: '100%'}}
        >
          <VSCodeOption value="json">JSON</VSCodeOption>
          <VSCodeOption value="csv">CSV</VSCodeOption>
        </VSCodeDropdown>
      </div>
      {!canStream ? (
        <div
          className="form-row"
          onClick={(event: React.MouseEvent) => event.stopPropagation()}
        >
          {buttonElement}
        </div>
      ) : (
        <>
          <div className="form-row">
            <VSCodeDropdown
              value={typeof amount === 'number' ? 'rows' : amount}
              onChange={({target}) => {
                const value = (target as HTMLInputElement).value;
                if (value === 'current' || value === 'all') {
                  setAmount(value);
                } else {
                  setAmount(rowLimit);
                }
              }}
              style={{width: '100%'}}
            >
              $
              {options.map(option => (
                <VSCodeOption key={option.value} value={option.value}>
                  ${option.label}
                </VSCodeOption>
              ))}
            </VSCodeDropdown>
          </div>
          {typeof amount === 'number' ? (
            <div className="form-row">
              <VSCodeTextField
                value={rowLimit.toString()}
                onInput={({target}) => {
                  const parsed = parseInt((target as HTMLInputElement).value);
                  if (!Number.isNaN(parsed)) {
                    setRowLimit(parsed);
                    setAmount(parsed);
                  }
                }}
                style={{width: '100%'}}
              ></VSCodeTextField>
            </div>
          ) : null}
          <div className="form-row">
            <VSCodeButton
              onClick={() => onDownload({format: format, amount: amount})}
            >
              Download
            </VSCodeButton>
            {amount === 'current' && (
              <VSCodeButton className="copy-button" onClick={copyToClipboard}>
                To Clipboard
              </VSCodeButton>
            )}
          </div>
        </>
      )}
    </Form>
  );
}

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 10px;

  .form-row {
    display: flex;
    gap: 10px;
  }
`;
