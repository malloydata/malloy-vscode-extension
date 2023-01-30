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
import { Dropdown, TextField, VSCodeButton } from "../components";

interface DownloadFormProps {
  onDownload: (options: QueryDownloadOptions) => Promise<void>;
  canStream: boolean;
}

export const DownloadForm: React.FC<DownloadFormProps> = ({
  onDownload,
  canStream,
}) => {
  const [format, setFormat] = useState<"json" | "csv">("json");
  const [rowLimit, setRowLimit] = useState(1000);
  const [amount, setAmount] = useState<"current" | "all" | number>("current");
  const options = canStream
    ? [
        { value: "current", label: "Current result set" },
        { value: "all", label: "All results" },
        { value: "rows", label: "Limited rows" },
      ]
    : [{ value: "current", label: "Current result set" }];
  return (
    <Form>
      <FormRow>
        <Dropdown
          value={format}
          setValue={(newValue) => setFormat(newValue as "json" | "csv")}
          options={[
            { value: "json", label: "JSON" },
            { value: "csv", label: "CSV" },
          ]}
          style={{ width: "100%" }}
        />
      </FormRow>
      <FormRow>
        <Dropdown
          value={typeof amount === "number" ? "rows" : amount}
          setValue={(newValue) => {
            if (newValue === "current" || newValue === "all") {
              setAmount(newValue);
            } else {
              setAmount(rowLimit);
            }
          }}
          options={options}
          style={{ width: "100%" }}
        />
      </FormRow>
      {typeof amount === "number" && (
        <FormRow>
          <TextField
            value={rowLimit.toString()}
            setValue={(newValue) => {
              const parsed = parseInt(newValue);
              if (!Number.isNaN(parsed)) {
                setRowLimit(parsed);
                setAmount(parsed);
              }
            }}
            style={{ width: "100%" }}
          />
        </FormRow>
      )}
      <FormRow>
        <VSCodeButton onClick={() => onDownload({ format, amount })}>
          Download
        </VSCodeButton>
      </FormRow>
    </Form>
  );
};

const Form = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const FormRow = styled.div`
  display: flex;
`;
