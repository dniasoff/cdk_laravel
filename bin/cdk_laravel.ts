#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';

import { LaravelService } from '../lib/laravel_service';
import { GlobalProperties } from '../lib/global_properties';
import { SharedServices } from '../lib/shared_services';

var globalProps: GlobalProperties = require('../settings.json');

var props = {
  env: {
    account: globalProps.cdkAccountId,
    region: globalProps.cdkRegion,
  }
}

const app = new cdk.App();

//create shared resources
new SharedServices(app, globalProps.serviceName, props, globalProps);

//Create dedicated ECS Clusters etc for each environment
new LaravelService(app, `${globalProps.serviceName}ServiceProduction`, props, globalProps, "master",0);
new LaravelService(app, `${globalProps.serviceName}ServiceDevelop`, props, globalProps, "develop",1);
new LaravelService(app, `${globalProps.serviceName}ServiceStaging`, props, globalProps, "staging",2);

//Tag all resources created by CDK
cdk.Tags.of(app).add("stack_type", "cdk");
cdk.Tags.of(app).add("service", globalProps.serviceName);


