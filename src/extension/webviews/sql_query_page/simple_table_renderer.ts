// /*
//  * Copyright 2023 Google LLC
//  *
//  * Permission is hereby granted, free of charge, to any person obtaining
//  * a copy of this software and associated documentation files
//  * (the "Software"), to deal in the Software without restriction,
//  * including without limitation the rights to use, copy, modify, merge,
//  * publish, distribute, sublicense, and/or sell copies of the Software,
//  * and to permit persons to whom the Software is furnished to do so,
//  * subject to the following conditions:
//  *
//  * The above copyright notice and this permission notice shall be
//  * included in all copies or substantial portions of the Software.
//  *
//  * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
//  * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
//  * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
//  * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
//  * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
//  * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
//  * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//  */

// import {MalloyQueryData} from '@malloydata/malloy';

// export async function render(
//   document: Document,
//   queryData: MalloyQueryData
// ): Promise<HTMLElement> {
//   const header = document.createElement('tr');

//   const firstRow = queryData.rows[0];
//   for (const key in Object.keys(firstRow)) {
//     const name = key;
//     const headerCell = document.createElement('th');
//     headerCell.style.cssText = `
//         padding: 8px;
//         color: var(--malloy-title-color, #505050);
//         border-bottom: 1px solid var(--malloy-border-color, #eaeaea);
//         text-align: 'left'
//       `;
//     headerCell.innerHTML = name.replace(/_/g, '_&#8203;');
//     header.appendChild(headerCell);
//   }

//   const tableBody = document.createElement('tbody');

//   for (const row of queryData.rows) {
//     const rowElement = document.createElement('tr');
//     for (const field of table.field.intrinsicFields) {
//       const childRenderer = this.childRenderers[field.name];
//       //await yieldTask();
//       const rendered = await childRenderer.render(row.cell(field));
//       const cellElement = this.document.createElement('td');
//       cellElement.style.cssText = `
//           padding: '8px'};
//           vertical-align: top;
//           border-bottom: 1px solid var(--malloy-border-color, #eaeaea);
//         `;
//       cellElement.appendChild(rendered);
//       rowElement.appendChild(cellElement);
//     }
//     tableBody.appendChild(rowElement);
//   }
//   const tableElement = document.createElement('table');
//   tableElement.style.cssText = `
//       border: 1px solid var(--malloy-border-color, #eaeaea);
//       vertical-align: top;
//       border-bottom: 1px solid var(--malloy-border-color, #eaeaea);
//       border-collapse: collapse;
//       width: 100%;
//     `;
//   const tableHead = document.createElement('thead');
//   tableHead.appendChild(header);
//   tableElement.appendChild(tableHead);
//   tableElement.appendChild(tableBody);
//   return tableElement;
// }
