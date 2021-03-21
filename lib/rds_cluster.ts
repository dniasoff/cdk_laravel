#!/usr/bin/env node
import "source-map-support/register"
import cdk = require('@aws-cdk/core');
import rds = require('@aws-cdk/aws-rds');

import { capitalizeFirstLetter, GlobalProperties } from "./global_properties";



class RdsCluster extends cdk.Stack {

  constructor(scope: cdk.App, id: string, props: cdk.StackProps, globalProps: GlobalProperties, isProduction: boolean) {
    super(scope, id, props);

    //Set up variables

    let environment: string;
    let dbCluster: rds.ServerlessCluster;
    let removalPolicy: cdk.RemovalPolicy;

    (isProduction) ? environment = "Production" : environment = "NonProduction";
    (isProduction) ? removalPolicy = cdk.RemovalPolicy.RETAIN : removalPolicy = cdk.RemovalPolicy.DESTROY;
    let instanceName: string = `${capitalizeFirstLetter(globalProps.serviceName.toLowerCase())}${capitalizeFirstLetter(environment)}`;


    // create db cluster
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

    (isProduction) ? globalProps.rdsClusterProduction = dbCluster : globalProps.rdsClusterDevelopment = dbCluster;

    cdk.Tags.of(this).add("branch", environment);

  }
}

export { RdsCluster }







