/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as React from 'react';
import {useEffect, useRef} from 'react';

export interface DOMElementProps {
  element: HTMLElement;
  className?: string;
  style?: React.CSSProperties;
}

export const DOMElement: React.FC<DOMElementProps> = ({
  element,
  className,
  style,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parent = ref.current;
    if (parent) {
      parent.innerHTML = '';
      parent.appendChild(element);
    }
  }, [element]);

  return <div ref={ref} className={className} style={style}></div>;
};
