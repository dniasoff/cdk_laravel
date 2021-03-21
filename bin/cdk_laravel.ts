#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';



import { LaravelService } from '../lib/laravel_service';
import { RdsCluster } from '../lib/rds_cluster';
import { RedisCluster } from '../lib/redis_cluster';
import { GlobalProperties } from '../lib/global_properties';
import { SharedResources } from '../lib/shared_resources';

var globalProps: GlobalProperties = require('../settings.json');

var props = {
  env: {
    account: globalProps.cdkAccountId,
    region: globalProps.cdkRegion,
  }
}


class SharedServices extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    new SharedResources(scope, `${id}-vpc`, props, globalProps);

    new RdsCluster(scope, `${id}-rds-prod`, props, globalProps, true);
    new RdsCluster(scope, `${id}-rds-dev`, props, globalProps, false);

    new RedisCluster(scope, `${id}-cache-prod`, props, globalProps, true);
    new RedisCluster(scope, `${id}-cache-dev`, props, globalProps, false);

  }
}


const app = new cdk.App();

//create shared resources
let sharedServices = new SharedServices(app, globalProps.serviceName, props);

let productionService = new LaravelService(app, `${globalProps.serviceName}-service-master`, props, globalProps, "master",0);
let developService = new LaravelService(app, `${globalProps.serviceName}-service-develop`, props, globalProps, "develop",1);
let stagingService = new LaravelService(app, `${globalProps.serviceName}-service-staging`, props, globalProps, "staging",2);


cdk.Tags.of(app).add("stack_type", "cdk");
cdk.Tags.of(app).add("service", globalProps.serviceName);


