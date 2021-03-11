#!/usr/bin/env node

import ec2 = require('@aws-cdk/aws-ec2');
import acm = require('@aws-cdk/aws-certificatemanager');
import route53 = require('@aws-cdk/aws-route53');
import rds = require('@aws-cdk/aws-rds');
import elasticache = require('@aws-cdk/aws-elasticache');

class GlobalProperties {
    ServiceName: string;
    Domain: string;
    SslCertificate: acm.DnsValidatedCertificate;
    HostedZone: route53.IHostedZone;
    Vpc: ec2.Vpc;
    RdsClusterProduction: rds.ServerlessCluster;
    RdsClusterDevelopment: rds.ServerlessCluster;
    CacheClusterProduction: elasticache.CfnCacheCluster;
    CacheClusterDevelopment: elasticache.CfnCacheCluster;
    RdsSg: ec2.SecurityGroup;
    RedisSg: ec2.SecurityGroup;
    BrefLayerVersion: string;
    LambdaCodePath: string;

  }

  export { GlobalProperties }