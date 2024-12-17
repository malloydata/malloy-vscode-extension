/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import {
  QueryDownloadCopyData,
  QueryDownloadOptions,
} from '../../../common/types/message_types';
import {PopupDialog} from '../components/PopupDialog';
import {DownloadForm} from './DownloadForm';
import {VSCodeButton} from '@vscode/webview-ui-toolkit/react';
import {Result} from '@malloydata/malloy';
import DownloadIcon from '../assets/download.svg';
import {useEffect, useState} from 'react';
import styled from 'styled-components';

export interface DownloadButtonProps {
  name?: string;
  result: Result;
  onDownload: (options: QueryDownloadOptions) => Promise<void>;
  onCopy: (options: QueryDownloadCopyData) => Promise<void>;
  canStream: boolean;
}

export function DownloadButton({
  name,
  result,
  onDownload,
  onCopy,
  canStream,
}: DownloadButtonProps) {
  const [open, setOpen] = useState(false);

  const onMouseDown = (_event: MouseEvent) => {
    // if (!this.contains(event.target as Node)) {
    //   setOpen(false);
    // }
  };

  const onClose = () => {
    setOpen(false);
  };

  useEffect(() => {
    document.addEventListener('mousedown', onMouseDown);

    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const mouseBlock = (event: React.MouseEvent) => event.stopPropagation();
  return (
    <div>
      <VSCodeButton
        appearance="icon"
        title="Download"
        onMouseDown={mouseBlock}
        onClick={() => setOpen(!open)}
      >
        <DownloadIcon />
      </VSCodeButton>
      <StyledPopupDialog open={open}>
        <DownloadForm
          name={name}
          result={result}
          canStream={canStream}
          onDownload={async (options: QueryDownloadOptions) => {
            onClose();
            await onDownload(options);
          }}
          onClose={onClose}
          onCopy={async (options: QueryDownloadCopyData) => {
            onClose();
            await onCopy(options);
          }}
        ></DownloadForm>
      </StyledPopupDialog>
    </div>
  );
}

const StyledPopupDialog = styled(PopupDialog)`
  width: 200px;
`;
