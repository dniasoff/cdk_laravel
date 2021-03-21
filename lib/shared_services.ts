
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';


import { RdsCluster } from '../lib/rds_cluster';
import { RedisCluster } from '../lib/redis_cluster';
import { SharedResources } from '../lib/shared_resources';
import { GlobalProperties } from '../lib/global_properties';

class SharedServices extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props: cdk.StackProps, globalProps: GlobalProperties,) {
      super(scope, id, props);
  
      new SharedResources(scope, `${id}Vpc`, props, globalProps);
  
      new RdsCluster(scope, `${id}RdsProduction`, props, globalProps, true);
      new RdsCluster(scope, `${id}RdsNonProduction`, props, globalProps, false);
  
      new RedisCluster(scope, `${id}CacheProduction`, props, globalProps, true);
      new RedisCluster(scope, `${id}CacheNonProduction`, props, globalProps, false);
  
    }
  }

  export { SharedServices }