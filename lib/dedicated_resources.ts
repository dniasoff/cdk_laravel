#!/usr/bin/env node

import "source-map-support/register"
import cdk = require('@aws-cdk/core');
import cloudfront = require('@aws-cdk/aws-cloudfront');
import route53 = require('@aws-cdk/aws-route53');
import s3 = require('@aws-cdk/aws-s3');
import rds = require('@aws-cdk/aws-rds');
import ecr = require('@aws-cdk/aws-ecr');
import ec2 = require('@aws-cdk/aws-ec2');
import ecs = require('@aws-cdk/aws-ecs');
import servicediscovery = require('@aws-cdk/aws-servicediscovery');
import iam = require('@aws-cdk/aws-iam');
import logs = require('@aws-cdk/aws-logs');
import elbv2 = require('@aws-cdk/aws-elasticloadbalancingv2');
import elasticache = require('@aws-cdk/aws-elasticache');
import targets = require('@aws-cdk/aws-route53-targets/lib');

import { capitalizeFirstLetter, GlobalProperties } from "./global_properties";

class DedicatedServiceInstance extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: cdk.StackProps, globalProps: GlobalProperties, branch: string, redisInstance: number) {
    super(scope, id, props);

    //Set up variables

    let dbCluster: rds.ServerlessCluster;
    let cacheCluster: elasticache.CfnCacheCluster;
    let environment: string;
    let removalPolicy: cdk.RemovalPolicy;

    (branch == "master") ? environment = "production" : environment = branch;
    (environment == "production") ? dbCluster = globalProps.rdsClusterProduction : dbCluster = globalProps.rdsClusterDevelopment;
    (environment == "production") ? cacheCluster = globalProps.cacheClusterProduction : cacheCluster = globalProps.cacheClusterDevelopment;
    (environment == "production") ? removalPolicy = cdk.RemovalPolicy.RETAIN : removalPolicy = cdk.RemovalPolicy.DESTROY;
    let instanceName: string = `${globalProps.serviceName}${capitalizeFirstLetter(environment)}`

    //create s3 bucket behind a cloudfront distribution to host static assets and dns entry to point to cloudfront.

    const bucket = new s3.Bucket(this, `${globalProps.serviceName}-${environment}-static-content`, {
      publicReadAccess: true,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'error.html',
      removalPolicy: removalPolicy,
    });

    const distribution = new cloudfront.CloudFrontWebDistribution(this, `${instanceName}SiteDistribution`, {
      aliasConfiguration: {
        acmCertRef: globalProps.cloudfrontSslCertificate.certificateArn,
        names: [`${environment}-static.${globalProps.domain}`],
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

    new route53.ARecord(this, `${instanceName}SiteAliasRecord`, {
      recordName: `${environment}-static.${globalProps.domain}`,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
      zone: globalProps.hostedZone
    });

    //Create an ECS cluster and task defintion to host the 2 containers needed for Laravel (NGINX & Laravel)

    const cluster = new ecs.Cluster(this, `${instanceName}FargateCluster`, {
      vpc: globalProps.vpc,
    });

        // Cloud Map Namespace
        const dnsNamespace = new servicediscovery.PrivateDnsNamespace(
          this,
          "DnsNamespace",
          {
            name: "http-api.local",
            vpc: globalProps.vpc,
            description: "Private DnsNamespace for Microservices",
          }
        );

    const taskrole = new iam.Role(this, `${instanceName}EcsTaskExecutionRole`, {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    taskrole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        "service-role/AmazonECSTaskExecutionRolePolicy"
      )
    );

    const ecsServiceTaskDefinition = new ecs.FargateTaskDefinition(
      this,
      `${instanceName}EcsServiceTaskDef`,
      {
        memoryLimitMiB: 512,
        cpu: 256,
        taskRole: taskrole,
      }
    );

    // Fargate Services

    const fargateServiceSecGrp = new ec2.SecurityGroup(
      this,
      `${instanceName}EcsServiceSecurityGroup`,
      {
        allowAllOutbound: true,
        securityGroupName: "laravelServiceSecurityGroup",
        vpc: globalProps.vpc,
      }
    );
    fargateServiceSecGrp.connections.allowFromAnyIpv4(ec2.Port.tcp(80));

    const laravelService = new ecs.FargateService(this, `${instanceName}EcsService`, {
      cluster: cluster,
      taskDefinition: ecsServiceTaskDefinition,
      assignPublicIp: false,
      desiredCount: 2,
      securityGroup: fargateServiceSecGrp,
      cloudMapOptions: {
        name: "laravelService",
        cloudMapNamespace: dnsNamespace,
      }
    });

    //Set up task definitions using containers hosted on existing ECR repositories
    // 2 linked containers will be needed, laravel for php requests and nginx to sit in front of laravel and respond to non php requests
    

    // Log Groups
    const nginxServiceLogGroup = new logs.LogGroup(
      this, 
      `${instanceName}NginxServiceLogGroup`, {
      logGroupName: "/ecs/nginxService",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const laravelServiceLogGroup = new logs.LogGroup(
      this,
      `${instanceName}LaravelServiceLogGroup`, {
        logGroupName: "/ecs/laravelService",
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }
    );

    const nginxServiceLogDriver = new ecs.AwsLogDriver({
      logGroup: nginxServiceLogGroup,
      streamPrefix: `${instanceName}NginxService`,
    });

    const laravelServiceLogDriver = new ecs.AwsLogDriver({
      logGroup: laravelServiceLogGroup,
      streamPrefix: `${instanceName}LaravelService`,
    });

    // Amazon ECR Repositories
    const nginxServicerepo = ecr.Repository.fromRepositoryName(
      this,
      `${instanceName}NginxServiceRepo`,
      "cdk_laravel/nginx"
    );

    const laravelServicerepo = ecr.Repository.fromRepositoryName(
      this,
      `${instanceName}LaravelServiceRepo`,
      "cdk_laravel/laravel"
    );

    //Fetch image tag from environment variable or use the branch specific image if there is no environment variable
    let imageTag: string = process.env.CDK_IMAGE_TAG || "undefined";

    if (imageTag == 'undefined') {
      (environment == "production") ? imageTag = "latest" : imageTag = branch;
    }

    // Task Containers
    const nginxServiceContainer = ecsServiceTaskDefinition.addContainer(
      `${instanceName}NginxServiceContainer`,
      {
        image: ecs.ContainerImage.fromEcrRepository(
          nginxServicerepo,
          imageTag,
        ),
        logging: nginxServiceLogDriver,
      }
    );

    const laravelServiceContainer = ecsServiceTaskDefinition.addContainer(
      `${instanceName}LaravelServiceContainer`,
      {
        image: ecs.ContainerImage.fromEcrRepository(
          laravelServicerepo,
          imageTag,
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
          "DB_DATABASE": `laravel_${environment}`,
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

    // ALB, listerners, target-groups

    const albSecGrp = new ec2.SecurityGroup(
      this,
      `${instanceName}AlbServiceSecurityGroup`,
      {
        allowAllOutbound: true,
        securityGroupName: "laravelAlbSecurityGroup",
        vpc: globalProps.vpc,
      }
    );
    albSecGrp.connections.allowFromAnyIpv4(ec2.Port.tcp(80));
    albSecGrp.connections.allowFromAnyIpv4(ec2.Port.tcp(443));

    const httpALB = new elbv2.ApplicationLoadBalancer(
      this,
      `${instanceName}Alb`,
      {
        vpc: globalProps.vpc,
        internetFacing: true,
      }
    );
    httpALB.addSecurityGroup(albSecGrp);
    httpALB.addRedirect();

    const httpsApiListener = httpALB.addListener("HttpsApiListener", {
      port: 443,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      certificates: [elbv2.ListenerCertificate.fromArn(globalProps.albSslCertificate.certificateArn)],
      // Default Target Group
      defaultAction: elbv2.ListenerAction.fixedResponse(200),

    });

    const laravelServiceTargetGroup = httpsApiListener.addTargets(`${instanceName}NginxServiceTargetGroup`,
      {
        port: 80,
        healthCheck: {
          path: "/login",
          interval: cdk.Duration.seconds(30),
          timeout: cdk.Duration.seconds(3),
        },
        targets: [laravelService],
        stickinessCookieDuration: cdk.Duration.seconds(86500),
      }
    );

    // Add LB DNS entries

    if (environment == "production") {

      new route53.ARecord(this, `${instanceName}AlbAliasRecord`, {
        recordName: `www.${globalProps.domain}`,
        target: route53.RecordTarget.fromAlias(new targets.LoadBalancerTarget(httpALB)),
        zone: globalProps.hostedZone
      });

      new route53.ARecord(this, `${instanceName}AlbAliasRecord2`, {
        recordName: `${globalProps.domain}`,
        target: route53.RecordTarget.fromAlias(new targets.LoadBalancerTarget(httpALB)),
        zone: globalProps.hostedZone
      });

    } else {

      new route53.ARecord(this, `${instanceName}AlbAliasRecord`, {
        recordName: `${environment}.${globalProps.domain}`,
        target: route53.RecordTarget.fromAlias(new targets.LoadBalancerTarget(httpALB)),
        zone: globalProps.hostedZone
      });

    }

    cdk.Tags.of(this).add("branch", branch);
  }
}


export { DedicatedServiceInstance }
