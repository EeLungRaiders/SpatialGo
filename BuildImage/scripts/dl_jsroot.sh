#!/bin/bash
set -e

JSROOT_VERSION="7.11.0"
JSROOT_TAR="JsRoot7110.tar.gz"
DOWNLOAD_URL="https://github.com/root-project/jsroot/releases/download/${JSROOT_VERSION}/${JSROOT_TAR}"

echo "Downloading JsRoot ${JSROOT_VERSION}..."
wget -q "$DOWNLOAD_URL" -O /tmp/${JSROOT_TAR}

mkdir -p /sv_dir/jsroot
tar xzvf /tmp/${JSROOT_TAR} -C /sv_dir/jsroot
rm /tmp/${JSROOT_TAR}

echo "JsRoot ${JSROOT_VERSION} installed successfully."
