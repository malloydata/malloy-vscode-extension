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
import React, { SVGProps } from "react";

const SvgDownloadIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    width="110px"
    height="110px"
    viewBox="0 0 110 110"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    xmlnsXlink="http://www.w3.org/1999/xlink"
    {...props}
  >
    <title>download_hover</title>
    <g
      id="download_hover"
      stroke="none"
      stroke-width="1"
      fill="none"
      fill-rule="evenodd"
    >
      <circle
        id="Oval"
        fill="#EAF2FF"
        className="hoverfill"
        cx="55"
        cy="55"
        r="55"
      ></circle>
      <g id="download_black_24dp" transform="translate(8.000000, 9.133308)">
        <rect id="Rectangle" x="0" y="0" width="94" height="94"></rect>
        <path
          d="M19.5833333,78.3333333 L74.4166667,78.3333333 L74.4166667,70.5 L19.5833333,70.5 L19.5833333,78.3333333 Z M74.4166667,35.25 L58.75,35.25 L58.75,11.75 L35.25,11.75 L35.25,35.25 L19.5833333,35.25 L47,62.6666667 L74.4166667,35.25 Z"
          id="Shape"
          fill="#4285F4"
          className="primaryfill"
          fill-rule="nonzero"
        ></path>
      </g>
    </g>
  </svg>
);

export default SvgDownloadIcon;
