/*
 * Copyright 2023 Google LLC
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

import React, { useState } from "react";
import styled from "styled-components";
import { QueryDownloadOptions } from "../../message_types";
import { Popover } from "../components/Popover";
import { DownloadForm } from "./DownloadForm";
import DownloadIcon from "../assets/download_hover.svg";

interface DownloadButtonProps {
  onDownload: (options: QueryDownloadOptions) => Promise<void>;
  canStream: boolean;
}

export const DownloadButton: React.FC<DownloadButtonProps> = ({
  onDownload,
  canStream,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <StyledDownloadIcon
        onClick={() => setOpen(true)}
        width={22}
        height={22}
      />
      <Popover
        open={open}
        setOpen={setOpen}
        width={200}
        offsetSkidding={10}
        offsetDistance={0}
      >
        <PopoverContent>
          <DownloadForm
            canStream={canStream}
            onDownload={async (options) => {
              onDownload(options);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </>
  );
};

const PopoverContent = styled.div`
  padding: 15px;
`;

const StyledDownloadIcon = styled(DownloadIcon)`
  cursor: pointer;
  .hoverfill {
    fill: transparent;
  }
  .primaryfill {
    fill: #d4d6d8;
  }
  &:hover {
    .hoverfill {
      fill: rgb(240, 246, 255);
    }
    .primaryfill {
      fill: #4285f4;
    }
  }
`;
