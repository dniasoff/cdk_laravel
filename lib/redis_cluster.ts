#!/usr/bin/env node
import "source-map-support/register"
import elasticache = require('@aws-cdk/aws-elasticache');
import ssm = require('@aws-cdk/aws-ssm');
import cdk = require('@aws-cdk/core');
import { App, Stack } from "@aws-cdk/core";
import { GlobalProperties } from "./shared_classes";

class RedisCluster extends Stack {
  
  constructor(scope: App, id: string, props: GlobalProperties, isProduction: boolean) {
    super(scope, id);

    let environment: string;
    let redisCluster : elasticache.CfnCacheCluster;

    if (isProduction) {
      environment = "prod"
    }
    else {
      environment = "non-prod"
    }

    // create private subnets groups (needed for redis) 
    const subnetGroup = new elasticache.CfnSubnetGroup(this, `${id}-subnet-group`, {
      description: `List of subnets used for redis cache ${id}`,
      subnetIds: props.Vpc.privateSubnets.map(function (subnet) {
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
        props.RedisSg.securityGroupId
      ]
    });

    if (isProduction){
      environment = "prod"
      props.CacheClusterProduction = redisCluster;
    }
    else
    {
      environment = "non-prod"
      props.CacheClusterDevelopment = redisCluster;
    }

    // Add SSM parameter for cache endpoint
    const param = new ssm.StringParameter(this, 'db-secret', {
      stringValue: redisCluster.attrRedisEndpointAddress,
      parameterName: `/${props.ServiceName}/${environment}/cacheEndpoint`
      // allowedPattern: '.*',
    });
    
    cdk.Tags.of(this).add("branch", environment);
 

  }
}

export { RedisCluster }