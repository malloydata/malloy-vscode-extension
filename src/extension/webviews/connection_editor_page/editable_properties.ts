/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {ConnectionPropertyInfo} from '../../../common/types/message_types';

/**
 * The properties the connection form can show.
 *
 * A property declared `source: 'overlay'` takes its value from an overlay the
 * host registered — a config file may name the overlay, but can never hold the
 * value, and the value itself may be a live object with methods. No form
 * control can produce a legal one, so the editor leaves such a property out
 * entirely.
 *
 * The test is `source`, not `type`. `type: 'opaque'` implies overlay-only
 * today, but the reverse does not hold: an ordinary typed property can be
 * declared overlay-only, and keying off the type would render it.
 */
export function editableProperties(
  properties: ConnectionPropertyInfo[]
): ConnectionPropertyInfo[] {
  return properties.filter(prop => prop.source !== 'overlay');
}
