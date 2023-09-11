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

import {URLReader} from '@malloydata/malloy';
import {DataStyles} from '@malloydata/render';
import {errorMessage} from '../common/errors';

export function compileDataStyles(styles: string): DataStyles {
  try {
    return JSON.parse(styles) as DataStyles;
  } catch (error) {
    throw new Error(`Error compiling data styles: ${errorMessage(error)}`);
  }
}

// TODO replace this with actual JSON metadata import functionality, when it exists
export async function dataStylesForFile(
  reader: URLReader,
  url: URL,
  text: string
): Promise<DataStyles> {
  const PREFIX = '--! styles ';
  let styles: DataStyles = {};
  for (const line of text.split('\n')) {
    if (line.startsWith(PREFIX)) {
      const fileName = line.trimEnd().substring(PREFIX.length);
      const styleUrl = new URL(fileName, url);
      // TODO instead of failing silently when the file does not exist, perform this after the WebView has been
      //      created, so that the error can be shown there.
      let stylesText: string;
      try {
        stylesText = await reader.readURL(styleUrl);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Error loading data style '${fileName}': ${error}`);
        stylesText = '{}';
      }
      styles = {...styles, ...compileDataStyles(stylesText)};
    }
  }

  return styles;
}

// TODO Come up with a better way to handle data styles. Perhaps this is
//      an in-language understanding of model "metadata". For now,
//      we abuse the `URLReader` API to keep track of requested URLs
//      and accumulate data styles for those files.
export class HackyDataStylesAccumulator implements URLReader {
  private dataStyles: DataStyles = {};

  constructor(private uriReader: URLReader) {}

  async readURL(uri: URL): Promise<string> {
    const contents = await this.uriReader.readURL(uri);
    this.dataStyles = {
      ...this.dataStyles,
      ...(await dataStylesForFile(this, uri, contents)),
    };

    return contents;
  }

  getHackyAccumulatedDataStyles(): DataStyles {
    return this.dataStyles;
  }
}
