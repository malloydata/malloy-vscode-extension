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

import startCase from "lodash/startCase";
import React from "react";
import {
  ConnectionConfigProperty,
  ExternalConnection,
  ExternalConnectionConfig,
} from "../../../../../common/connection_manager_types";
import { BooleanField, NumberField, TextField } from "../../../components";
import { Label } from "../../../components/Label";
import { LabelCell } from "../../../components/LabelCell";

interface BooleanPropertyProps {
  name: string;
  value: boolean | undefined;
  setValue: (value: boolean) => void;
}

const BooleanProperty: React.FC<BooleanPropertyProps> = ({
  name,
  setValue,
  value,
}) => {
  return (
    <tr>
      <LabelCell>
        <Label>{name}:</Label>
      </LabelCell>
      <td>
        <BooleanField value={value} setValue={setValue} />
      </td>
    </tr>
  );
};

interface StringPropertyProps {
  name: string;
  value: string | undefined;
  setValue: (value: string) => void;
}

const StringProperty: React.FC<StringPropertyProps> = ({
  name,
  setValue,
  value,
}) => {
  return (
    <tr>
      <LabelCell>
        <Label>{name}:</Label>
      </LabelCell>
      <td>
        <TextField value={value || ""} setValue={setValue} />
      </td>
    </tr>
  );
};

interface NumberPropertyProps {
  name: string;
  value: number | undefined;
  setValue: (value: number) => void;
}

const NumberProperty: React.FC<NumberPropertyProps> = ({
  name,
  setValue,
  value,
}) => {
  return (
    <tr>
      <LabelCell>
        <Label>{name}:</Label>
      </LabelCell>
      <td>
        <NumberField value={value} setValue={setValue} />
      </td>
    </tr>
  );
};

interface ExternalConnectionEditorProps {
  config: ExternalConnectionConfig;
  setConfig: (config: ExternalConnectionConfig) => void;
  externalConnection: ExternalConnection;
}

export const ExternalConnectionEditor: React.FC<
  ExternalConnectionEditorProps
> = ({ config, setConfig, externalConnection }) => {
  const mapProperties = (
    properties: Record<string, ConnectionConfigProperty>
  ) => {
    const fields = Object.entries(properties);
    return fields.map(([name, property]) => {
      const { default: propertyDefault, type, title } = property;
      switch (type) {
        case "string":
          return (
            <StringProperty
              key={name}
              name={title || startCase(name)}
              value={
                config[name] != null ? String(config[name]) : propertyDefault
              }
              setValue={(value) =>
                setConfig({
                  ...config,
                  [name]: value,
                })
              }
            />
          );
        case "number":
          return (
            <NumberProperty
              key={name}
              name={title || startCase(name)}
              value={
                config[name] != null ? Number(config[name]) : propertyDefault
              }
              setValue={(value) =>
                setConfig({
                  ...config,
                  [name]: value,
                })
              }
            />
          );
        case "boolean":
          return (
            <BooleanProperty
              key={name}
              name={title || startCase(name)}
              value={config[name] != null ? !!config[name] : propertyDefault}
              setValue={(value) =>
                setConfig({
                  ...config,
                  [name]: value,
                })
              }
            />
          );
      }
    });
  };

  return externalConnection ? (
    <table>
      <tbody>
        <tr>
          <LabelCell>
            <Label>Name:</Label>
          </LabelCell>
          <td>
            <TextField
              value={config.name}
              setValue={(name) => {
                setConfig({ ...config, name });
              }}
            />
          </td>
        </tr>
        {mapProperties(externalConnection.properties)}
      </tbody>
    </table>
  ) : null;
};
