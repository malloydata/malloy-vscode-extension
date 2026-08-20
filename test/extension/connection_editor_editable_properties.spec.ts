/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {ConnectionPropertyInfo} from '../../src/common/types/message_types';
import {editableProperties} from '../../src/extension/webviews/connection_editor_page/editable_properties';

const prop = (
  overrides: Partial<ConnectionPropertyInfo> & {name: string}
): ConnectionPropertyInfo => ({
  displayName: overrides.name,
  type: 'string',
  ...overrides,
});

describe('editableProperties', () => {
  it('keeps properties with no declared source', () => {
    const props = [prop({name: 'server'}), prop({name: 'port'})];
    expect(editableProperties(props).map(p => p.name)).toEqual([
      'server',
      'port',
    ]);
  });

  it('keeps literal-only properties', () => {
    const props = [prop({name: 'securityPolicy', source: 'literal'})];
    expect(editableProperties(props).map(p => p.name)).toEqual([
      'securityPolicy',
    ]);
  });

  it('drops overlay-only properties', () => {
    const props = [
      prop({name: 'projectId'}),
      prop({name: 'authClient', type: 'opaque', source: 'overlay'}),
    ];
    expect(editableProperties(props).map(p => p.name)).toEqual(['projectId']);
  });

  it('drops an overlay-only property of an ordinary type', () => {
    const props = [prop({name: 'tenantId', type: 'string', source: 'overlay'})];
    expect(editableProperties(props)).toEqual([]);
  });

  it('keeps an opaque property that is not overlay-only', () => {
    // The hiding rule is about where a value may come from, not its shape.
    const props = [prop({name: 'handle', type: 'opaque'})];
    expect(editableProperties(props).map(p => p.name)).toEqual(['handle']);
  });
});
