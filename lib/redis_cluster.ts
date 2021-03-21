#!/usr/bin/env node
import "source-map-support/register"
import elasticache = require('@aws-cdk/aws-elasticache');
import ssm = require('@aws-cdk/aws-ssm');
import cdk = require('@aws-cdk/core');
import { App, Stack } from "@aws-cdk/core";
import { GlobalProperties } from "./global_properties";

class RedisCluster extends Stack {
  
  constructor(scope: App, id: string, props: cdk.StackProps, globalProps: GlobalProperties, isProduction: boolean) {
    super(scope, id, props);

    let environment: string;
    let redisCluster : elasticache.CfnCacheCluster;

    (isProduction) ? environment = "prod" : environment = "non-prod";

    // create private subnets groups (needed for redis) 
    const subnetGroup = new elasticache.CfnSubnetGroup(this, `${id}-subnet-group`, {
      description: `List of subnets used for redis cache ${id}`,
      subnetIds: globalProps.vpc .privateSubnets.map(function (subnet) {
        return subnet.subnetId;
      })
    });

    // The cluster resource itself.
    redisCluster = new elasticache.CfnCacheCluster(this, `${id}-cluster`, {
      cacheNodeType: 'cache.t2.micro',
      engine: 'redis',
      numCacheNodes: 1,
      autoMinorVersionUpgrade: true,
      cacheSubnetGroupName: subnetGroup.ref,
      vpcSecurityGroupIds: [
        globalProps.redisSg.securityGroupId
      ]
    });

    (isProduction) ? globalProps.cacheClusterProduction = redisCluster : globalProps.cacheClusterDevelopment = redisCluster;
    
    cdk.Tags.of(this).add("branch", environment);
 

  }
}

export { RedisCluster }