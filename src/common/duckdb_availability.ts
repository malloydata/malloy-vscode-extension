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
/**
 * Whether or not DuckDB is available for the current build/architecture.
 * This is set to true here, but may be overridden during the actual build.
 * See the build script for details.
 */
export const isDuckDBAvailable = true;

/**
 * Returns the error message if DuckDB failed to load at runtime.
 * This can happen when the native module has GLIBC version requirements
 * that the current environment doesn't satisfy (e.g., in devcontainers
 * with older glibc versions).
 */
export function getDuckDBLoadError(): string | null {
  return null;
}

/**
 * Returns true if DuckDB is available both at build time AND successfully
 * loaded at runtime. Use this instead of isDuckDBAvailable for accurate
 * runtime checks.
 */
export function isDuckDBRuntimeAvailable(): boolean {
  return isDuckDBAvailable && getDuckDBLoadError() === null;
}
