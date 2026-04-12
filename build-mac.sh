#!/bin/bash

npm run dist:mac
npx electron-builder --mac --arm64
