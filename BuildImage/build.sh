#!/bin/bash
set -e
username=${USER:-$(id -u -n)}
groupname=$(id -g -n)
userid=${UID:-$(id -u)}
groupid=$(id -g)

echo "Building with user: $username ($userid:$groupid)"


# If for more log, Add "--progress=plain"
docker build \
 --build-arg USERNAME=${username} \
 --build-arg GROUPNAME=${groupname} \
 --build-arg UID=${userid} \
 --build-arg GID=${groupid} \
 --target USER \
 -t jsroot_forgo3d_${username} \
 .
