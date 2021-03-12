#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { GlobalProperties } from '../lib/shared_classes';
import { SharedStack } from '../lib/shared_stack';
import { Stack, App } from '@aws-cdk/core';
import { LaravelService } from '../lib/laravel_service';
import { RdsCluster } from '../lib/rds_cluster';
import { RedisCluster } from '../lib/redis_cluster';


var props: GlobalProperties = require('../settings.json');



class SharedServices extends Stack {
  constructor(scope: App, id: string) {
    super(scope, id);

     new SharedStack(app,`${id}-vpc`,props);

     new RdsCluster(app, `${id}-rds-prod`, props, true);
     new RdsCluster(app, `${id}-rds-dev`, props, false);

     new RedisCluster(app, `${id}-cache-prod`, props, true);
     new RedisCluster(app, `${id}-cache-dev`, props, false);

  }
}


const app = new cdk.App();

//create shared resources
let sharedServices = new SharedServices(app, props.serviceName);

let productionService = new LaravelService(app, `${props.serviceName}-service-master`, props, "production", "production",0);
let developService = new LaravelService(app, `${props.serviceName}-service-develop`, props, "develop", "develop",1);
let stagingService = new LaravelService(app, `${props.serviceName}-service-staging`, props, "staging", "staging",2);


cdk.Tags.of(app).add("stack_type", "cdk");
cdk.Tags.of(app).add("service", props.serviceName);


