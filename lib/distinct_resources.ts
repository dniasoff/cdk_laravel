#!/usr/bin/env node
import "source-map-support/register"
import cdk = require('@aws-cdk/core');
import rds = require('@aws-cdk/aws-rds');
import elasticache = require('@aws-cdk/aws-elasticache');

import { GlobalProperties } from "./global_properties";



class DistinctResources extends cdk.Stack {

  constructor(scope: cdk.App, id: string, props: cdk.StackProps, globalProps: GlobalProperties, isProduction: boolean) {
    super(scope, id, props);

    //Set up variables

    let environment: string;
    let dbCluster: rds.ServerlessCluster;
    let redisCluster: elasticache.CfnCacheCluster;
    let removalPolicy: cdk.RemovalPolicy;

    (isProduction) ? environment = "Production" : environment = "NonProduction";
    (isProduction) ? removalPolicy = cdk.RemovalPolicy.RETAIN : removalPolicy = cdk.RemovalPolicy.DESTROY;
    let instanceName: string = `${globalProps.serviceName}${environment}`;


    // create rds db cluster
    dbCluster = new rds.ServerlessCluster(this, `${instanceName}DbCluster`, {
      engine: rds.DatabaseClusterEngine.AURORA_MYSQL,

      parameterGroup: rds.ParameterGroup.fromParameterGroupName(this, 'ParameterGroup', 'default.aurora-mysql5.7'),
      vpc: globalProps.vpc,
      scaling: {
        autoPause: isProduction ? cdk.Duration.seconds(300) : cdk.Duration.seconds(300),
        maxCapacity: isProduction ? rds.AuroraCapacityUnit.ACU_4 : rds.AuroraCapacityUnit.ACU_2,
        minCapacity: rds.AuroraCapacityUnit.ACU_1,
      },
      securityGroups: [globalProps.rdsSg],
      backupRetention: isProduction ? cdk.Duration.days(35) : cdk.Duration.days(3),
      removalPolicy: removalPolicy,
      deletionProtection: false,
    });

    //create redis elasticache cluster

    // create private subnets groups (needed for redis) 
    const subnetGroup = new elasticache.CfnSubnetGroup(this, `${instanceName}ElasticacheSubnetGroup`, {
      description: `List of subnets used for redis cache ${id}`,
      subnetIds: globalProps.vpc.privateSubnets.map(function (subnet) {
        return subnet.subnetId;
      })
    });

    // The redis cluster resource itself.
    redisCluster = new elasticache.CfnCacheCluster(this, `${instanceName}ElasticacheCluster`, {
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
    (isProduction) ? globalProps.rdsClusterProduction = dbCluster : globalProps.rdsClusterDevelopment = dbCluster;

    cdk.Tags.of(this).add("branch", environment);

  }
}

export { DistinctResources }






