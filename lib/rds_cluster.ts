#!/usr/bin/env node
import "source-map-support/register"
import rds = require('@aws-cdk/aws-rds');
import ssm = require('@aws-cdk/aws-ssm');
import cdk = require('@aws-cdk/core');
import { App, Duration, RemovalPolicy, Stack } from "@aws-cdk/core";
import { GlobalProperties } from "./shared_classes";



class RdsCluster extends Stack {
  
  constructor(scope: App, id: string, props: cdk.StackProps, globalProps: GlobalProperties, isProduction: boolean) {    
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
          autoPause: isProduction? Duration.seconds(300) : Duration.seconds(300),
          maxCapacity: isProduction ? rds.AuroraCapacityUnit.ACU_4 : rds.AuroraCapacityUnit.ACU_2,
          minCapacity: rds.AuroraCapacityUnit.ACU_1,
      },
      securityGroups: [globalProps.rdsSg],
      backupRetention: isProduction ? Duration.days(35) : Duration.days(3),
      removalPolicy: isProduction ? RemovalPolicy.DESTROY : RemovalPolicy.DESTROY,
      deletionProtection: false,
      
      
    });

    (isProduction) ? globalProps.rdsClusterProduction = dbCluster : globalProps.rdsClusterDevelopment = dbCluster;
    

 

    const param = new ssm.StringParameter(this, 'db-secret', {
      stringValue: `${dbCluster.secret?.secretArn}`,
      parameterName: `/${globalProps.serviceName}/${environment}/dbSecretArn`
      // allowedPattern: '.*',
    });

    cdk.Tags.of(this).add("branch", environment);
       
  }
}


export { RdsCluster }
    





  
  