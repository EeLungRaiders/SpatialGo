#!/bin/bash

SCFULLNAME=`realpath $0`
SCPATH=`dirname $SCFULLNAME`
INP_FILELIST=${1-"ERROR:INP_FILELIST is missing"}

if [ ! -s "${INP_FILELIST}" ];
then
 echo "empty file"
 exit 13
fi

cat "${INP_FILELIST}" | awk '
{
 gsub(/\${WORKDIR}/, "'${WORKDIR}'");
 gsub(/\${JSROOTSYS}/, "'${JSROOTSYS}'");
 if (NF==2)
  print "cp", $1, $2;
}' | awk '{system($0)}'

