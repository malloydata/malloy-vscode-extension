/*
 * Copyright 2024 Google LLC
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

import {html} from 'lit';

export const spinner = html`<svg
  width="25px"
  height="25px"
  viewBox="0 0 15 15"
  version="1.1"
  xmlns="http://www.w3.org/2000/svg"
  xmlns:xlink="http://www.w3.org/1999/xlink"
>
  <title>malloy-icon-status-progress</title>
  <defs>
    <circle id="path-1" cx="7.5" cy="7.5" r="7.5"></circle>
    <mask
      id="mask-2"
      maskContentUnits="userSpaceOnUse"
      maskUnits="objectBoundingBox"
      x="0"
      y="0"
      width="15"
      height="15"
      fill="white"
    >
      <use xlink:href="#path-1"></use>
    </mask>
  </defs>
  <g
    id="malloy-icon-status-progress"
    stroke="none"
    stroke-width="1"
    fill="none"
    fill-rule="evenodd"
    stroke-dasharray="16"
  >
    <use
      id="Oval-Copy-3"
      stroke="#1a73e8"
      mask="url(#mask-2)"
      stroke-width="3"
      transform="translate(7.500000, 7.500000) rotate(-240.000000) translate(-7.500000, -7.500000) "
      xlink:href="#path-1"
    ></use>
  </g>
</svg>`;
