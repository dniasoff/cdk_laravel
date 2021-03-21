#!/usr/bin/env node
import "source-map-support/register"
import cdk = require('@aws-cdk/core');
import rds = require('@aws-cdk/aws-rds');

import { GlobalProperties } from "./global_properties";



class RdsCluster extends cdk.Stack {
  
  constructor(scope: cdk.App, id: string, props: cdk.StackProps, globalProps: GlobalProperties, isProduction: boolean) {    
    super(scope, id, props);

    let environment: string;
    let dbCluster: rds.ServerlessCluster;
    
    (isProduction) ? environment = "prod" : environment = "non-prod";
    
    // create db cluster
    dbCluster = new  rds.ServerlessCluster(this, `${id}-dbcluster`, {
      engine: rds.DatabaseClusterEngine.AURORA_MYSQL,
      
      parameterGroup: rds.ParameterGroup.fromParameterGroupName(this, 'ParameterGroup', 'default.aurora-mysql5.7'),
      vpc: globalProps.vpc ,
      scaling: {
          autoPause: isProduction? cdk.Duration.seconds(300) : cdk.Duration.seconds(300),
          maxCapacity: isProduction ? rds.AuroraCapacityUnit.ACU_4 : rds.AuroraCapacityUnit.ACU_2,
          minCapacity: rds.AuroraCapacityUnit.ACU_1,
      },
      securityGroups: [globalProps.rdsSg],
      backupRetention: isProduction ? cdk.Duration.days(35) : cdk.Duration.days(3),
      removalPolicy: isProduction ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.DESTROY,
      deletionProtection: false,
      
      
    });

    (isProduction) ? globalProps.rdsClusterProduction = dbCluster : globalProps.rdsClusterDevelopment = dbCluster;
    
    cdk.Tags.of(this).add("branch", environment);
       
  }
}


export { RdsCluster }
    





  
  