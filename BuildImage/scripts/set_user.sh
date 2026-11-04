#!/bin/bash

USERNAME=$(echo "$1" | awk -F: '{print $1}')
GROUPNAME=$(echo "$1" | awk -F: '{print $2}')
USERID=$(echo "$2" | awk -F: '{print $1}')
GROUPID=$(echo "$2" | awk -F: '{print $2}')

echo "user=${USERNAME} group=${GROUPNAME} uid=${USERID} gid=${GROUPID}"

if getent group "${GROUPID}" >/dev/null 2>&1; then
  echo "group id ${GROUPID} already present"
else
  echo "adding group id ${GROUPID}"
  groupadd -g "${GROUPID}" "${GROUPNAME}"
  getent group "${GROUPID}"
fi

if getent passwd "${USERID}" >/dev/null 2>&1; then
  echo "user id ${USERID} already present"
else
  echo "adding user id ${USERID}"
  useradd -m -u "${USERID}" -g "${GROUPID}" --create-home --home-dir "/home/${USERNAME}" "${USERNAME}"
  getent passwd "${USERID}"
fi
