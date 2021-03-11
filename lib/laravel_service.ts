#!/usr/bin/env node

import "source-map-support/register"
import cloudfront = require('@aws-cdk/aws-cloudfront');
import route53 = require('@aws-cdk/aws-route53');
import s3 = require('@aws-cdk/aws-s3');
import acm = require('@aws-cdk/aws-certificatemanager');
import rds = require('@aws-cdk/aws-rds');
import cdk = require('@aws-cdk/core');
import ssm = require('@aws-cdk/aws-ssm');
import ec2 = require('@aws-cdk/aws-ec2');
import * as ecs from "@aws-cdk/aws-ecs";
import * as iam from "@aws-cdk/aws-iam";
import * as logs from "@aws-cdk/aws-logs";
import * as elbv2 from "@aws-cdk/aws-elasticloadbalancingv2";
import * as apig from "@aws-cdk/aws-apigatewayv2";
import secretsManager = require('@aws-cdk/aws-secretsmanager');
import elasticache = require('@aws-cdk/aws-elasticache');
import { App, Stack, Duration, RemovalPolicy } from "@aws-cdk/core";
import rdsClient = require('@aws-sdk/client-rds');
import * as servicediscovery from "@aws-cdk/aws-servicediscovery";
import * as ecr from "@aws-cdk/aws-ecr";
import targets = require('@aws-cdk/aws-route53-targets/lib');
import { GlobalProperties } from "./shared_classes";




class LaravelService extends Stack {
  constructor(scope: App, id: string, props: GlobalProperties, branch: string, dnsPrefix: string) {
    super(scope, id);

    let bucket: s3.Bucket;
    let dbCluster: rds.ServerlessCluster;
    let cacheCluster: elasticache.CfnCacheCluster;



    if (branch == "prod") {
      bucket = new s3.Bucket(this, `${props.ServiceName}-static-content-${branch}`, {
        publicReadAccess: true,
        websiteIndexDocument: 'index.html',
        websiteErrorDocument: 'error.html',
        removalPolicy: RemovalPolicy.DESTROY,
      });

      dbCluster = props.RdsClusterProduction;
      cacheCluster = props.CacheClusterProduction;
    }
    else {
      bucket = new s3.Bucket(this, `${props.ServiceName}-static-content-${branch}`, {
        publicReadAccess: true,
        websiteIndexDocument: 'index.html',
        websiteErrorDocument: 'error.html',
        removalPolicy: RemovalPolicy.DESTROY,
      });

      dbCluster = props.RdsClusterDevelopment
      cacheCluster = props.CacheClusterDevelopment;
    }


    const distribution = new cloudfront.CloudFrontWebDistribution(this, 'SiteDistribution', {
      aliasConfiguration: {
        acmCertRef: props.SslCertificate.certificateArn,
        names: [`${dnsPrefix}-static.${props.Domain}`],
        sslMethod: cloudfront.SSLMethod.SNI,
        securityPolicy: cloudfront.SecurityPolicyProtocol.TLS_V1_1_2016,
      },
      originConfigs: [
        {
          customOriginSource: {
            domainName: bucket.bucketWebsiteDomainName,
            originProtocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          },
          behaviors: [{ isDefaultBehavior: true }],
        }
      ]
    });

    new route53.ARecord(this, 'SiteAliasRecord', {
      recordName: `${dnsPrefix}-static.${props.Domain}`,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
      zone: props.HostedZone
    });


    // ECS Cluster
    const cluster = new ecs.Cluster(this, "Fargate Cluster", {
      vpc: props.Vpc
    });

    // Cloud Map Namespace
    const dnsNamespace = new servicediscovery.PrivateDnsNamespace(
      this,
      "DnsNamespace",
      {
        name: "http-api.local",
        vpc: props.Vpc,
        description: "Private DnsNamespace for Microservices",
      }
    );

    // Task Role
    const taskrole = new iam.Role(this, "ecsTaskExecutionRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    taskrole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        "service-role/AmazonECSTaskExecutionRolePolicy"
      )
    );


    // Task Definitions
    const nginxServiceTaskDefinition = new ecs.FargateTaskDefinition(
      this,
      "nginxTaskDef",
      {
        memoryLimitMiB: 128,
        cpu: 256,
        taskRole: taskrole,
      }
    );

    const laravelServiceTaskDefinition = new ecs.FargateTaskDefinition(
      this,
      "LaravelTaskDef",
      {
        memoryLimitMiB: 512,
        cpu: 512,
        taskRole: taskrole,
      }
    );

    // Log Groups
    const nginxServiceLogGroup = new logs.LogGroup(this, "nginxServiceLogGroup", {
      logGroupName: "/ecs/nginxService",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const laravelServiceLogGroup = new logs.LogGroup(
      this,
      "laravelServiceLogGroup",
      {
        logGroupName: "/ecs/laravelService",
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }
    );

    const nginxServiceLogDriver = new ecs.AwsLogDriver({
      logGroup: nginxServiceLogGroup,
      streamPrefix: "nginxService",
    });

    const laravelServiceLogDriver = new ecs.AwsLogDriver({
      logGroup: laravelServiceLogGroup,
      streamPrefix: "laravelService",
    });

     // Amazon ECR Repositories
     const nginxServicerepo = ecr.Repository.fromRepositoryName(
      this,
      "nginxServiceRepo",
      "nginx-service"
    );

    const laravelServicerepo = ecr.Repository.fromRepositoryName(
      this,
      "laravelServiceRepo",
      "laravel-service"
    );

    // Task Containers
    const nginxServiceContainer = nginxServiceTaskDefinition.addContainer(
      "nginxServiceContainer",
      {
        image: ecs.ContainerImage.fromEcrRepository(nginxServicerepo),
        logging: nginxServiceLogDriver,
      }
    );

    const laravelServiceContainer = laravelServiceTaskDefinition.addContainer(
      "laravelServiceContainer",
      {
        image: ecs.ContainerImage.fromEcrRepository(laravelServicerepo),
        logging: laravelServiceLogDriver,
      }
    );

    nginxServiceContainer.addPortMappings({
      containerPort: 8000,
    });

    laravelServiceContainer.addPortMappings({
      containerPort: 9000,
    });

    //Security Groups
    const nginxServiceSecGrp = new ec2.SecurityGroup(
      this,
      "nginxServiceSecurityGroup",
      {
        allowAllOutbound: true,
        securityGroupName: "nginxServiceSecurityGroup",
        vpc: props.Vpc,
      }
    );

    nginxServiceSecGrp.connections.allowFromAnyIpv4(ec2.Port.tcp(8000));

    const laravelServiceSecGrp = new ec2.SecurityGroup(
      this,
      "laravelServiceSecurityGroup",
      {
        allowAllOutbound: true,
        securityGroupName: "laravelServiceSecurityGroup",
        vpc: props.Vpc,
      }
    );

    laravelServiceSecGrp.connections.allowFromAnyIpv4(ec2.Port.tcp(9000));

    // Fargate Services
    const nginxService = new ecs.FargateService(this, "nginxService", {
      cluster: cluster,
      taskDefinition: nginxServiceTaskDefinition,
      assignPublicIp: false,
      desiredCount: 2,
      securityGroup: nginxServiceSecGrp,
      cloudMapOptions: {
        name: "nginxService",
        cloudMapNamespace: dnsNamespace,
      },
    });

    const laravelService = new ecs.FargateService(this, "laravelService", {
      cluster: cluster,
      taskDefinition: laravelServiceTaskDefinition,
      assignPublicIp: false,
      desiredCount: 2,
      securityGroup: laravelServiceSecGrp,
      cloudMapOptions: {
        name: "laravelService",
        cloudMapNamespace: dnsNamespace,
      },
    });

    // ALB
    const httpApiInternalALB = new elbv2.ApplicationLoadBalancer(
      this,
      "httpapiInternalALB",
      {
        vpc: props.Vpc,
        internetFacing: true,
      }
    );

    // ALB Listener
    const httpApiListener = httpApiInternalALB.addListener("httpapiListener", {
      port: 80,
      // Default Target Group
      defaultAction: elbv2.ListenerAction.fixedResponse(200),
    });



    const laravelServiceTargetGroup = httpApiListener.addTargets(
      "nginxServiceTargetGroup",
      {
        port: 80,
        priority: 2,
        healthCheck: {
          path: "/api/authors/health",
          interval: cdk.Duration.seconds(30),
          timeout: cdk.Duration.seconds(3),
        },
        targets: [nginxService],
        pathPattern: "/",
      }
    );



    cdk.Tags.of(this).add("branch", branch);
  }
}

export { LaravelService }