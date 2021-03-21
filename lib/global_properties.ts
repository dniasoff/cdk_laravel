#!/usr/bin/env node

import ec2 = require('@aws-cdk/aws-ec2');
import acm = require('@aws-cdk/aws-certificatemanager');
import route53 = require('@aws-cdk/aws-route53');
import rds = require('@aws-cdk/aws-rds');
import elasticache = require('@aws-cdk/aws-elasticache');

interface GlobalProperties {
    serviceName: string;
    domain: string;
    cloudfrontSslCertificate: acm.DnsValidatedCertificate;
    albSslCertificate: acm.DnsValidatedCertificate;
    hostedZone: route53.IHostedZone;
    hostedZoneId: string;
    vpc: ec2.Vpc;
    vpcCidr: string;
    rdsClusterProduction: rds.ServerlessCluster;
    rdsClusterDevelopment: rds.ServerlessCluster;
    cacheClusterProduction: elasticache.CfnCacheCluster;
    cacheClusterDevelopment: elasticache.CfnCacheCluster;
    rdsSg: ec2.SecurityGroup;
    redisSg: ec2.SecurityGroup;
    cdkAccountId: string;
    cdkRegion: string;
  }

  function capitalizeFirstLetter(string: string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  
  export { GlobalProperties, capitalizeFirstLetter }