#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { GlobalProperties } from '../lib/shared_classes';
import { SharedStack } from '../lib/shared_stack';
import { Stack, App } from '@aws-cdk/core';
import { LaravelService } from '../lib/laravel_service';
import { RdsCluster } from '../lib/rds_cluster';
import { RedisCluster } from '../lib/redis_cluster';



var props = new GlobalProperties();


props.Domain = "kodespace.co.uk";
props.ServiceName = "symple";
props.LambdaCodePath = "arn:aws:lambda:eu-west-2:209497400698:layer:php-74-fpm:18";
props.LambdaCodePath = "../nodejs-mysql-links"



var hostedZoneId: string = "Z016552312S0N2LCUKQCF";
var vpc_cidr: string = "10.10.0.0/16";

class SharedServices extends Stack {
  constructor(scope: App, id: string) {
    super(scope, id);

     new SharedStack(app,`${id}-vpc`,props, vpc_cidr,hostedZoneId);

     new RdsCluster(app, `${id}-rds-prod`, props, true);
     new RdsCluster(app, `${id}-rds-dev`, props, false);

     new RedisCluster(app, `${id}-cache-prod`, props, true);
     new RedisCluster(app, `${id}-cache-dev`, props, false);

  }
}


const app = new cdk.App();

//create shared resources
let sharedServices = new SharedServices(app, props.ServiceName);

//create service instances





let devService = new LaravelService(app, `${props.ServiceName}-service-dev`, props, "dev", "dev");

cdk.Tags.of(app).add("stack_type", "cdk");
cdk.Tags.of(app).add("service", props.ServiceName);


