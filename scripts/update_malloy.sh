#!/bin/bash

npm install $(yarn --silent ts-node ./scripts/malloy-packages.ts $1)
