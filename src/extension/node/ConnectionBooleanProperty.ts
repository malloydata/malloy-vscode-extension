export interface ConnectionBooleanProperty {
  type: "boolean";
  const?: boolean;
}

export interface ConnectionStringProperty {
  type: "string";
  const?: boolean;
}

export type ConnectionConfigProperty =
  | ConnectionBooleanProperty
  | ConnectionStringProperty;

export interface ExternalConnection {
  bundle: string;
  name: string;
  dialect: string;
  properties: {
    [key: string]: ConnectionConfigProperty;
  };
}
