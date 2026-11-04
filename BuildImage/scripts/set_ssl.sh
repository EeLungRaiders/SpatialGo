#!/bin/bash

cd /etc/ssl
openssl genrsa -out server.key 2048
openssl req -new -key server.key -out server.csr -subj "/CN=localhost"
cp server.key server.key.orig
openssl rsa -in server.key.orig -out server.key
openssl x509 -req -days 365 -in server.csr -signkey server.key -out server.crt
cp server.crt server.pem
cat server.key >> server.pem
