#!/bin/bash


SERVICE_NAME=$(jq -r .serviceName settings.json)
GIT_BRANCH=$(git branch | sed -n -e 's/^\* \(.*\)/\1/p')

if [ "$GIT_BRANCH" == "master" ]
then
    SERVICE_INSTANCE="Production"
else
    SERVICE_INSTANCE=${GIT_BRANCH^}
fi

echo -n "${SERVICE_NAME}Service${SERVICE_INSTANCE}"