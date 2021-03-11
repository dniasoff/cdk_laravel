#!/usr/bin/env node
import "source-map-support/register"
import rds = require('@aws-cdk/aws-rds');
import ssm = require('@aws-cdk/aws-ssm');
import cdk = require('@aws-cdk/core');
import { App, Duration, RemovalPolicy, Stack } from "@aws-cdk/core";
import { GlobalProperties } from "./shared_classes";



class RdsCluster extends Stack {
  
  constructor(scope: App, id: string, props: GlobalProperties, isProduction: boolean) {    
    super(scope, id);

    let environment: string;
    let dbCluster: rds.ServerlessCluster;
    
    // create db cluster
    dbCluster = new  rds.ServerlessCluster(this, `${id}-dbcluster`, {
      engine: rds.DatabaseClusterEngine.AURORA_MYSQL,
      
      parameterGroup: rds.ParameterGroup.fromParameterGroupName(this, 'ParameterGroup', 'default.aurora-mysql5.7'),
      vpc: props.Vpc,
      scaling: {
          autoPause: isProduction? Duration.seconds(300) : Duration.seconds(300),
          maxCapacity: isProduction ? rds.AuroraCapacityUnit.ACU_4 : rds.AuroraCapacityUnit.ACU_2,
          minCapacity: rds.AuroraCapacityUnit.ACU_1,
      },
      securityGroups: [props.RdsSg],
      backupRetention: isProduction ? Duration.days(35) : Duration.days(3),
      removalPolicy: isProduction ? RemovalPolicy.DESTROY : RemovalPolicy.DESTROY,
      deletionProtection: false,
      
      
    });

    

    if (isProduction){
      environment = "prod"
      props.RdsClusterProduction = dbCluster;
    }
    else
    {
      environment = "non-prod"
      props.RdsClusterDevelopment = dbCluster;
    }

    const param = new ssm.StringParameter(this, 'db-secret', {
      stringValue: `${dbCluster.secret?.secretArn}`,
      parameterName: `/${props.ServiceName}/${environment}/dbSecretArn`
      // allowedPattern: '.*',
    });

    cdk.Tags.of(this).add("branch", environment);
       
  }
}


export { RdsCluster }
    





  
  