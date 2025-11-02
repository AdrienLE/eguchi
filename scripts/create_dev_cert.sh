#!/usr/bin/env bash
set -e

mkdir -p certs
openssl req \
  -newkey rsa:2048 -nodes \
  -keyout certs/localhost-key.pem \
  -x509 \
  -days 365 \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" \
  -out certs/localhost.pem
