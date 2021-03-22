#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';

import { GlobalProperties } from '../lib/global_properties';
import { CommonResources } from '../lib/common_resources';
import { SharedResources } from '../lib/shared_resources';
import { DedicatedServiceInstance } from '../lib/dedicated_resources';

var globalProps: GlobalProperties = require('../settings.json');

var props = {
  env: {
    account: globalProps.cdkAccountId,
    region: globalProps.cdkRegion,
  }
}

const app = new cdk.App();

//create shared resources


new CommonResources(app, `${globalProps.serviceName}ResourcesCommon`, props, globalProps);
new SharedResources(app, `${globalProps.serviceName}ResourcesProduction`, props, globalProps, true);
new SharedResources(app, `${globalProps.serviceName}ResourcesNonProduction`, props, globalProps, false);


//Create dedicated ECS Clusters etc for each environment
new DedicatedServiceInstance(app, `${globalProps.serviceName}ServiceProduction`, props, globalProps, "master",0);
new DedicatedServiceInstance(app, `${globalProps.serviceName}ServiceDevelop`, props, globalProps, "develop",1);
new DedicatedServiceInstance(app, `${globalProps.serviceName}ServiceStaging`, props, globalProps, "staging",2);

//Tag all resources created by CDK
cdk.Tags.of(app).add("stack_type", "cdk");
cdk.Tags.of(app).add("service", globalProps.serviceName);


