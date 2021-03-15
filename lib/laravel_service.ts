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
import { RdsCluster } from "./rds_cluster";
import { RedisCluster } from "./redis_cluster";
import { SharedStack } from "./shared_stack";




class LaravelService extends Stack {
  constructor(scope: App, id: string, props: GlobalProperties, branch: string, redisInstance: number) {
    super(scope, id);

    let bucket: s3.Bucket;
    let dbCluster: rds.ServerlessCluster;
    let cacheCluster: elasticache.CfnCacheCluster;
    let environment: string;

    (branch == "master" ) ? environment = "production" : environment = branch;
    (environment == "production") ? dbCluster = props.rdsClusterProduction : dbCluster = props.rdsClusterDevelopment ;
    (environment == "production") ? cacheCluster = props.cacheClusterProduction : cacheCluster = props.cacheClusterDevelopment ;



    if (environment == "production") {

      bucket = new s3.Bucket(this, `${props.serviceName}-static-content-production`, {
        publicReadAccess: true,
        websiteIndexDocument: 'index.html',
        websiteErrorDocument: 'error.html',
        removalPolicy: RemovalPolicy.DESTROY,
      });

    }
    else {

      bucket = new s3.Bucket(this, `${props.serviceName}-static-content-${branch}`, {
        publicReadAccess: true,
        websiteIndexDocument: 'index.html',
        websiteErrorDocument: 'error.html',
        removalPolicy: RemovalPolicy.DESTROY,
      });

    }


    const distribution = new cloudfront.CloudFrontWebDistribution(this, 'SiteDistribution', {
      aliasConfiguration: {
        acmCertRef: props.sslCertificate.certificateArn,
        names: [`${environment}-static.${props.domain}`],
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
      recordName: `${environment}-static.${props.domain}`,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
      zone: props.hostedZone
    });


    // ECS Cluster
    const cluster = new ecs.Cluster(this, "Fargate Cluster", {
      vpc: props.vpc  
    });

    // Cloud Map Namespace
    const dnsNamespace = new servicediscovery.PrivateDnsNamespace(
      this,
      "DnsNamespace",
      {
        name: "http-api.local",
        vpc: props.vpc  ,
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


    const laravelServiceTaskDefinition = new ecs.FargateTaskDefinition(
      this,
      "laravelTaskDef",
      {
        memoryLimitMiB: 512,
        cpu: 256,
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
      "cdk_laravel/nginx"
    );

    const laravelServicerepo = ecr.Repository.fromRepositoryName(
      this,
      "laravelServiceRepo",
      "cdk_laravel/laravel"
    );

    let tag: string;
    (environment == "production") ? tag="latest" : tag=branch;

    // Task Containers
    const nginxServiceContainer = laravelServiceTaskDefinition.addContainer(
      "nginxServiceContainer",
      {
        image: ecs.ContainerImage.fromEcrRepository(
          nginxServicerepo,
          tag,
        ),
        logging: nginxServiceLogDriver,
      }
    );
 
    const laravelServiceContainer = laravelServiceTaskDefinition.addContainer(
      "laravelServiceContainer",
      {
        image: ecs.ContainerImage.fromEcrRepository(
          laravelServicerepo,
          tag,
        ),
        logging: laravelServiceLogDriver,
        environment:
        {
          "APP_NAME": "laravel",
          "APP_KEY": `base64:SRLF3MRn3osyurFAVuqDgl82xznZk+y9TfFebyUALEY=`,
          "APP_DEBUG": "true",
          "DB_CONNECTION": "mysql",
          "DB_HOST": dbCluster.clusterEndpoint.hostname,
          "DB_PORT": "3306",
          "DB_DATABASE": `laravel-${environment}`,
          "DB_USERNAME": "admin",
          "DB_PASSWORD": `${dbCluster.secret?.secretValueFromJson('password')}`,
          "REDIS_HOST": cacheCluster.attrRedisEndpointAddress,
          "REDIS_DB": redisInstance.toString(),

        }
      }
    );

    nginxServiceContainer.addContainerDependencies({
      container: laravelServiceContainer,
      condition: ecs.ContainerDependencyCondition.START,
    });

    nginxServiceContainer.addPortMappings({
      containerPort: 80,
    });

    laravelServiceContainer.addPortMappings({
      containerPort: 9000,
    });

    const laravelServiceSecGrp = new ec2.SecurityGroup(
      this,
      "laravelServiceSecurityGroup",
      {
        allowAllOutbound: true,
        securityGroupName: "laravelServiceSecurityGroup",
        vpc: props.vpc  ,
      }
    );


    laravelServiceSecGrp.connections.allowFromAnyIpv4(ec2.Port.tcp(80));

    // // Fargate Services


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

    const albSecGrp = new ec2.SecurityGroup(
      this,
      "albServiceSecurityGroup",
      {
        allowAllOutbound: true,
        securityGroupName: "laravelAlbSecurityGroup",
        vpc: props.vpc  ,
      }
    );

    albSecGrp.connections.allowFromAnyIpv4(ec2.Port.tcp(80));
    albSecGrp.connections.allowFromAnyIpv4(ec2.Port.tcp(443));

    // ALB
    const httpALB = new elbv2.ApplicationLoadBalancer(
      this,
      "httpapiInternalALB",
      {
        vpc: props.vpc  ,
        internetFacing: true,
      }
    );

    httpALB.addSecurityGroup(albSecGrp);
    httpALB.addRedirect();



    const albSslCert = new acm.DnsValidatedCertificate(this, 'albSiteCertificate', {
      domainName: props.domain,
      subjectAlternativeNames: [`*.${props.domain}`],
      hostedZone: props.hostedZone,
    })

    const httpsApiListener = httpALB.addListener("httpsapiListener", {
      port: 443,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      certificates: [elbv2.ListenerCertificate.fromArn(albSslCert.certificateArn)],
      // Default Target Group
      defaultAction: elbv2.ListenerAction.fixedResponse(200),

    });

    const laravelServiceTargetGroup = httpsApiListener.addTargets(
      "nginxServiceTargetGroup",
      {
        port: 80,
        healthCheck: {
          path: "/login",
          interval: cdk.Duration.seconds(30),
          timeout: cdk.Duration.seconds(3),
        },
        targets: [laravelService],
        stickinessCookieDuration: cdk.Duration.seconds(86500)

      }
    );


 
// Add LB DNS entries

  if (environment == "production") {

      new route53.ARecord(this, 'AlbAliasRecord', {
        recordName: `www.${props.domain}`,
        target: route53.RecordTarget.fromAlias(new targets.LoadBalancerTarget(httpALB)),
        zone: props.hostedZone
      });

      new route53.ARecord(this, 'AlbAliasRecord2', {
        recordName: `${props.domain}`,
        target: route53.RecordTarget.fromAlias(new targets.LoadBalancerTarget(httpALB)),
        zone: props.hostedZone
      });

    } else {

      new route53.ARecord(this, 'AlbAliasRecord', {
        recordName: `${environment}.${props.domain}`,
        target: route53.RecordTarget.fromAlias(new targets.LoadBalancerTarget(httpALB)),
        zone: props.hostedZone
      });

    }



    cdk.Tags.of(this).add("branch", branch);
  }
}

export { LaravelService }