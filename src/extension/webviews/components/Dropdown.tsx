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

import React, { useEffect, useRef } from "react";
import { VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react";

interface DropdownProps {
  value: string;
  setValue: (value: string) => void;
  id?: string;
  options: { value: string; label: string }[];
  style?: React.CSSProperties;
}

export const Dropdown: React.FC<DropdownProps> = ({
  value,
  setValue,
  id,
  options,
  style,
}) => {
  const onChange = (event: any) => {
    setValue(event.target.value);
  };

  // TODO: This is a hack because the VSCodeDropdown doesn't immediately select
  //       the correct value. It requires a bump to update itself.
  const theElement = useRef<any>(null);
  useEffect(() => {
    if (theElement.current) {
      theElement.current.value = value;
    }
  });

  return (
    <VSCodeDropdown
      value={value}
      onChange={onChange}
      id={id}
      ref={theElement}
      style={style}
    >
      {options.map((option, index) => (
        <VSCodeOption
          key={index}
          value={option.value}
          selected={value === option.value}
        >
          {option.label}
        </VSCodeOption>
      ))}
    </VSCodeDropdown>
  );
};
